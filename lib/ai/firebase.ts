import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
  type GenerativeModel,
} from "firebase/ai";
import { firebase } from "@/lib/firebase/client";

/**
 * Лінива ініціалізація моделі Gemini для парсингу замовлень. Викликається з
 * клієнта. Передбачає що App Check вже ініціалізований у firebase/client.ts.
 *
 * Schema задає structured output — Gemini поверне валідний JSON за схемою.
 */
let _orderParserModel: GenerativeModel | undefined;

export function getOrderParserModel(): GenerativeModel {
  if (_orderParserModel) return _orderParserModel;

  const ai = getAI(firebase.app, { backend: new GoogleAIBackend() });

  const orderSchema = Schema.object({
    properties: {
      customerName: Schema.string({
        description:
          "Імʼя клієнта рівно як його озвучили у фразі. null якщо не згадано.",
        nullable: true,
      }),
      items: Schema.array({
        items: Schema.object({
          properties: {
            productName: Schema.string({
              description: "Назва товару з фрази (як назвав користувач).",
            }),
            categoryName: Schema.string({
              description:
                "Категорія товару — підбери НАЙБЛИЖЧЕ з переданого списку категорій.",
            }),
            quantity: Schema.number({
              description: "Кількість одиниць. Якщо не вказано — 1.",
            }),
            unitPrice: Schema.number({
              description: "Ціна за одиницю в грн. Якщо не озвучено — 0.",
            }),
          },
          optionalProperties: [],
        }),
      }),
      delivery: Schema.object({
        nullable: true,
        properties: {
          method: Schema.enumString({
            enum: [
              "nova_poshta",
              "ukrposhta",
              "meest",
              "courier",
              "self_pickup",
              "other",
            ],
            nullable: true,
            description:
              "Спосіб доставки: nova_poshta для 'Нова Пошта/НП', ukrposhta для 'Укрпошта', meest для 'Meest', courier для 'кур'єр/самовивіз з адресою', self_pickup для 'самовивіз без адреси', other для іншого.",
          }),
          cost: Schema.number({
            nullable: true,
            description: "Вартість доставки в грн. null якщо не озвучено.",
          }),
          paidBy: Schema.enumString({
            enum: ["customer", "us"],
            nullable: true,
            description:
              "Хто оплачує доставку: customer (платить клієнт) або us (платимо ми). null якщо неясно.",
          }),
          trackingNumber: Schema.string({
            nullable: true,
            description: "ТТН / номер відправлення якщо озвучено.",
          }),
          address: Schema.string({
            nullable: true,
            description: "Адреса або номер відділення якщо озвучено.",
          }),
        },
        optionalProperties: ["cost", "paidBy", "trackingNumber", "address"],
      }),
      notes: Schema.string({
        nullable: true,
        description: "Додаткові коментарі/побажання які не вписались деінде.",
      }),
    },
    optionalProperties: ["delivery", "notes"],
  });

  const ai_logic = ai;
  _orderParserModel = getGenerativeModel(ai_logic, {
    model: "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: orderSchema,
      temperature: 0.1,
    },
  });
  return _orderParserModel;
}
