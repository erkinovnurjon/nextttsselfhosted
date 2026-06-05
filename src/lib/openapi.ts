// NextTTS — OpenAPI 3.0 spetsifikatsiyasi.
// /api/openapi orqali beriladi, /api-docs sahifasida Swagger UI bilan ko'rsatiladi.

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "NextTTS API",
    version: "1.0.0",
    description:
      "O'zbek tilida self-hosted TTS platformasi API'si. Sintez (TTS), transkripsiya (STT), foydalanuvchi, kredit balansi va to'lov (Payme/Click) endpointlari.",
  },
  servers: [
    { url: "/", description: "Joriy host" },
    { url: "https://tts.example.uz", description: "Production (APP_URL)" },
  ],
  tags: [
    { name: "Auth", description: "Ro'yxatdan o'tish / kirish" },
    { name: "TTS", description: "Matndan nutq" },
    { name: "STT", description: "Nutqdan matn (transkripsiya)" },
    { name: "Account", description: "Foydalanuvchi va statistika" },
    { name: "Credits", description: "Kredit balansi va tranzaksiyalar" },
    { name: "Payments", description: "Balans to'ldirish (Payme / Click)" },
  ],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Yangi foydalanuvchi yaratish",
        description: "Birinchi ro'yxatdan o'tgan foydalanuvchi avtomatik admin bo'ladi.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Yaratildi",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/UserBrief" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "409": {
            description: "Email band",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
    },

    "/api/auth/csrf": {
      get: {
        tags: ["Auth"],
        summary: "CSRF token olish (login/logout uchun kerak)",
        description: "NextAuth credentials login'i csrfToken talab qiladi. Avval shu yerdan oling.",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: { csrfToken: { type: "string" } } },
              },
            },
          },
        },
      },
    },

    "/api/auth/callback/credentials": {
      post: {
        tags: ["Auth"],
        summary: "Kirish (email + parol)",
        description:
          "NextAuth credentials login. Form-urlencoded: csrfToken (/api/auth/csrf dan), email, password. Muvaffaqiyatda sessiya cookie (authjs.session-token) o'rnatiladi. Frontendда signIn('credentials') shu endpointni chaqiradi.",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["csrfToken", "email", "password"],
                properties: {
                  csrfToken: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  callbackUrl: { type: "string" },
                  json: { type: "string", example: "true" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Muvaffaqiyat (json:true bo'lsa) — { url } qaytadi va cookie o'rnatiladi",
            content: {
              "application/json": {
                schema: { type: "object", properties: { url: { type: "string" } } },
              },
            },
          },
          "302": { description: "Redirect + Set-Cookie (json:true bo'lmasa)" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/auth/session": {
      get: {
        tags: ["Auth"],
        summary: "Joriy sessiya",
        description: "Login bo'lmagan bo'lsa bo'sh obyekt qaytadi.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "Sessiya yoki {}",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Session" } },
            },
          },
        },
      },
    },

    "/api/auth/signout": {
      post: {
        tags: ["Auth"],
        summary: "Chiqish (logout)",
        description: "Form-urlencoded: csrfToken. Sessiya cookie o'chiriladi.",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["csrfToken"],
                properties: { csrfToken: { type: "string" }, json: { type: "string", example: "true" } },
              },
            },
          },
        },
        responses: { "200": { description: "Chiqildi" }, "302": { description: "Redirect" } },
      },
    },

    "/api/tts": {
      post: {
        tags: ["TTS"],
        summary: "Matnni nutqqa aylantirish",
        description:
          "WAV audio qaytaradi. Limitdan oshsa 429, backend ishlamasa 502. Har sintez kredit/limitdan yechiladi.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TtsInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Audio (WAV)",
            headers: {
              "X-Synthesis-Time-Sec": { schema: { type: "string" }, description: "Sintez vaqti (s)" },
              "X-Usage-Remaining": { schema: { type: "string" }, description: "Qolgan limit" },
            },
            content: {
              "audio/wav": { schema: { type: "string", format: "binary" } },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "429": {
            description: "Limit tugadi",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    usage: { $ref: "#/components/schemas/Usage" },
                    requiresAuth: { type: "boolean" },
                  },
                },
              },
            },
          },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
      get: {
        tags: ["TTS"],
        summary: "Backend holati (health) + limit",
        responses: {
          "200": {
            description: "Tayyor",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    available: { type: "boolean" },
                    usage: { $ref: "#/components/schemas/Usage" },
                  },
                },
              },
            },
          },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
    },

    "/api/transcribe": {
      post: {
        tags: ["STT"],
        summary: "Audio (WAV) -> matn",
        description: "Body — xom WAV bayt (application/octet-stream).",
        requestBody: {
          required: true,
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        responses: {
          "200": {
            description: "Tanildi",
            content: {
              "application/json": {
                schema: { type: "object", properties: { text: { type: "string" } } },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
    },

    "/api/me": {
      get: {
        tags: ["Account"],
        summary: "Joriy foydalanuvchi: profil, limit, statistika, so'nggi sintezlar",
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 30, maximum: 200 },
            description: "So'nggi sintezlar soni",
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Me" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/credits": {
      get: {
        tags: ["Credits"],
        summary: "Balans xulosasi + tranzaksiyalar (ledger)",
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CreditSummary" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Credits"],
        summary: "Demo to'ldirish (gateway'siz, test uchun)",
        description: "⚠️ Productionда o'chirilishi kerak — tekin kredit qo'shadi.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "Qo'shildi",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    added: { type: "integer" },
                    balance: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/payments/checkout": {
      get: {
        tags: ["Payments"],
        summary: "Sozlangan provayderlar ro'yxati",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    payme: { type: "boolean" },
                    click: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Payments"],
        summary: "To'lovni boshlash — buyurtma yaratadi, checkout URL qaytaradi",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CheckoutInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Buyurtma yaratildi",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orderId: { type: "string" },
                    checkoutUrl: { type: "string", format: "uri" },
                    credits: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "503": {
            description: "Provayder sozlanmagan (.env)",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
    },

    "/api/payments/status": {
      get: {
        tags: ["Payments"],
        summary: "Buyurtma holati (success sahifasi polling qiladi)",
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: "order", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["pending", "paid", "canceled", "failed"] },
                    provider: { type: "string", enum: ["payme", "click"] },
                    amountSom: { type: "integer" },
                    credits: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/Error" },
        },
      },
    },

    "/api/payments/payme": {
      post: {
        tags: ["Payments"],
        summary: "Payme Merchant API webhook (JSON-RPC)",
        description:
          "Payme serveri chaqiradi. Basic auth (Paycom:KEY). Bu endpoint odamlar uchun emas — provayder uchun.",
        security: [{ paymeBasic: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/JsonRpcRequest" },
              examples: {
                CheckPerformTransaction: {
                  value: {
                    method: "CheckPerformTransaction",
                    params: { amount: 1000000, account: { order_id: "ckxxxx" } },
                    id: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "JSON-RPC javob",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcResponse" },
              },
            },
          },
        },
      },
    },

    "/api/payments/click/prepare": {
      post: {
        tags: ["Payments"],
        summary: "Click Prepare (action=0) webhook",
        description: "Click serveri form-urlencoded yuboradi. MD5 imzo tekshiriladi.",
        requestBody: {
          content: {
            "application/x-www-form-urlencoded": {
              schema: { $ref: "#/components/schemas/ClickRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Click javobi",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ClickResponse" } },
            },
          },
        },
      },
    },

    "/api/payments/click/complete": {
      post: {
        tags: ["Payments"],
        summary: "Click Complete (action=1) webhook",
        description: "To'lovni tasdiqlaydi va kredit beradi (idempotent).",
        requestBody: {
          content: {
            "application/x-www-form-urlencoded": {
              schema: { $ref: "#/components/schemas/ClickRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Click javobi",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ClickResponse" } },
            },
          },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "authjs.session-token",
        description: "Auth.js sessiya cookie'si (login orqali olinadi).",
      },
      paymeBasic: {
        type: "http",
        scheme: "basic",
        description: "Payme: login=Paycom, parol=PAYME_KEY.",
      },
    },
    responses: {
      Error: {
        description: "Xato",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
      Unauthorized: {
        description: "Avtorizatsiya kerak",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      RegisterInput: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", minLength: 2 },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 6 },
        },
      },
      UserBrief: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          name: { type: "string", nullable: true },
          role: { type: "string", enum: ["user", "admin"] },
        },
      },
      Session: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
              role: { type: "string", enum: ["user", "admin"] },
            },
          },
          expires: { type: "string", format: "date-time" },
        },
      },
      TtsInput: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string" },
          checkpoint_id: { type: "string", example: "mms" },
          voice: { type: "string", enum: ["base", "ayol", "erkak"], example: "base" },
          speaking_rate: { type: "number", example: 0.9 },
          speed: { type: "number", example: 1.0 },
          language: { type: "string", example: "tr" },
        },
      },
      Usage: {
        type: "object",
        properties: {
          role: { type: "string" },
          limit: { type: "integer" },
          charsUsed: { type: "integer" },
          remaining: { type: "integer" },
          resetAt: { type: "string", format: "date-time" },
        },
      },
      Me: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
              role: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          usage: { $ref: "#/components/schemas/Usage" },
          stats: {
            type: "object",
            properties: {
              total: { type: "integer" },
              today: { type: "integer" },
              charsToday: { type: "integer" },
            },
          },
          recent: {
            type: "array",
            items: { $ref: "#/components/schemas/SynthesisItem" },
          },
        },
      },
      SynthesisItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          voice: { type: "string" },
          charCount: { type: "integer" },
          durationSec: { type: "number", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreditSummary: {
        type: "object",
        properties: {
          balance: { type: "integer" },
          granted: { type: "integer" },
          spent: { type: "integer" },
          ledger: {
            type: "array",
            items: { $ref: "#/components/schemas/LedgerEntry" },
          },
        },
      },
      LedgerEntry: {
        type: "object",
        properties: {
          id: { type: "string" },
          amount: { type: "integer", description: "+ olingan, − sarflangan" },
          reason: { type: "string", enum: ["signup", "synthesis", "topup", "admin"] },
          balanceAfter: { type: "integer" },
          meta: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CheckoutInput: {
        type: "object",
        required: ["provider", "amountSom"],
        properties: {
          provider: { type: "string", enum: ["payme", "click"] },
          amountSom: { type: "integer", minimum: 1000, maximum: 10000000, example: 10000 },
        },
      },
      JsonRpcRequest: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: [
              "CheckPerformTransaction",
              "CreateTransaction",
              "PerformTransaction",
              "CancelTransaction",
              "CheckTransaction",
              "GetStatement",
            ],
          },
          params: { type: "object" },
          id: { oneOf: [{ type: "integer" }, { type: "string" }] },
        },
      },
      JsonRpcResponse: {
        type: "object",
        properties: {
          jsonrpc: { type: "string", example: "2.0" },
          id: {},
          result: { type: "object" },
          error: {
            type: "object",
            properties: {
              code: { type: "integer" },
              message: { type: "object" },
              data: { type: "string" },
            },
          },
        },
      },
      ClickRequest: {
        type: "object",
        properties: {
          click_trans_id: { type: "string" },
          service_id: { type: "string" },
          merchant_trans_id: { type: "string", description: "buyurtma (order) id" },
          merchant_prepare_id: { type: "string" },
          amount: { type: "string", example: "10000.00" },
          action: { type: "string", enum: ["0", "1"] },
          error: { type: "string" },
          sign_time: { type: "string" },
          sign_string: { type: "string", description: "MD5 imzo" },
        },
      },
      ClickResponse: {
        type: "object",
        properties: {
          click_trans_id: { type: "string" },
          merchant_trans_id: { type: "string" },
          merchant_prepare_id: { type: "string" },
          merchant_confirm_id: { type: "string" },
          error: { type: "integer", description: "0 = muvaffaqiyat" },
          error_note: { type: "string" },
        },
      },
    },
  },
} as const;
