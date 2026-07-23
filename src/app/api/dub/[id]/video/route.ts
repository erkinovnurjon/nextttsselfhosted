import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import { Readable } from "stream";
import { auth } from "@/lib/auth";
import { isValidJobId, jobVideoPath } from "@/lib/dub";

// Tayyor dublyaj mp4'ini uzatadi.
//
// Job'ni XOTIRADAN qidirmaymiz: har Next.js marshruti alohida modul bundle'i,
// ya'ni /api/dub dagi `jobs` Map shu yerda BO'SH bo'ladi (aynan shu sabab
// oldin tayyor video 404 qaytargan). Yo'lni sessiyadagi userId'dan yig'amiz —
// foydalanuvchi faqat o'z papkasiga tusha oladi, jobId esa shakl bo'yicha
// tekshiriladi ("../" dan himoya). Bu server qayta yuklansa ham ishlaydi.
//
// Butun faylni bufer'ga o'qimaymiz (video yuzlab MB bo'lishi mumkin) — oqim.
// Range qo'llab-quvvatlanadi, aks holda <video> da oldinga o'tib bo'lmaydi.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await ctx.params;
  if (!isValidJobId(id)) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }

  const file = jobVideoPath(userId, id);
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    // Hali tayyor emas yoki umuman yo'q — ikkalasi ham foydalanuvchi uchun bir xil.
    return NextResponse.json({ error: "Dublyaj topilmadi yoki hali tayyor emas" }, { status: 404 });
  }

  const range = request.headers.get("range");
  const base = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] !== "" || m[2] !== "")) {
      let start: number;
      let end: number;
      if (m[1] === "") {
        // Suffiks: "bytes=-N" = OXIRGI N bayt (0..N emas!). Brauzer mp4 `moov`
        // atomini aynan shunday so'raydi — noto'g'ri o'qilsa video ochilmaydi.
        const n = Number(m[2]);
        start = Math.max(0, size - n);
        end = size - 1;
      } else {
        start = Number(m[1]);
        end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const stream = Readable.toWeb(
        createReadStream(file, { start, end })
      ) as unknown as ReadableStream;
      return new NextResponse(stream, {
        status: 206,
        headers: {
          ...base,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: { ...base, "Content-Length": String(size) },
  });
}
