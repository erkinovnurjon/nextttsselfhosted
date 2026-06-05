import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/openapi";

// OpenAPI 3.0 spetsifikatsiyasi (JSON). Swagger UI shu yerdan o'qiydi.
export function GET() {
  return NextResponse.json(openapiSpec);
}
