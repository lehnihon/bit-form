import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as yup from "yup";
import Joi from "joi";

import { zodResolver } from "./zod";
import { yupResolver } from "./yup";
import { joiResolver } from "./joi";

describe("Resolvers Validation Consistency", () => {
  const complexData = {
    user: {
      profile: { name: "Li" },
    },
    tags: ["React", "V"],
  };

  describe("Deep Structures (Nested & Arrays)", () => {
    it("Zod: deve mapear caminhos aninhados e índices de array com pontos", async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(3, "Nome curto"),
          }),
        }),
        tags: z.array(z.string().min(2, "Tag curta")),
      });

      const resolver = zodResolver(schema);
      const errors = await resolver(complexData as any);

      expect(errors["user.profile.name"]).toBe("Nome curto");
      expect(errors["tags.1"]).toBe("Tag curta");
    });

    it("Yup: deve mapear caminhos aninhados e índices de array automaticamente", async () => {
      const schema = yup.object({
        user: yup.object({
          profile: yup.object({
            name: yup.string().min(3, "Nome curto"),
          }),
        }),
        tags: yup.array().of(yup.string().min(2, "Tag curta")),
      });

      const resolver = yupResolver(schema);
      const errors = await resolver(complexData as any);

      expect(errors["user.profile.name"]).toBe("Nome curto");
      expect(errors["tags.1"]).toBe("Tag curta");
    });

    it("Joi: deve mapear caminhos aninhados e índices de array", async () => {
      const schema = Joi.object({
        user: Joi.object({
          profile: Joi.object({
            name: Joi.string().min(3).messages({ "string.min": "Nome curto" }),
          }),
        }),
        tags: Joi.array().items(
          Joi.string().min(2).messages({ "string.min": "Tag curta" }),
        ),
      });

      const resolver = joiResolver(schema);
      const errors = await resolver(complexData as any);

      expect(errors["user.profile.name"]).toBe("Nome curto");
      expect(errors["tags.1"]).toBe("Tag curta");
    });
  });

  describe("Targeted Validation (Partial)", () => {
    const invalidData = {
      name: "Ab",
      email: "invalid-email",
    };

    it("Zod: deve validar apenas os campos informados em scopeFields", async () => {
      const schema = z.object({
        name: z.string().min(5, "Nome curto"),
        email: z.string().email("Email inválido"),
      });

      const resolver = zodResolver(schema);
      const errors = await resolver(invalidData as any, {
        scopeFields: ["name"],
      });

      expect(errors.name).toBe("Nome curto");
      expect(errors.email).toBeUndefined();
    });

    it("Yup: deve validar apenas os campos informados em scopeFields", async () => {
      const schema = yup.object({
        name: yup.string().min(5, "Nome curto"),
        email: yup.string().email("Email inválido"),
      });

      const resolver = yupResolver(schema);
      const errors = await resolver(invalidData as any, {
        scopeFields: ["email"],
      });

      expect(errors.email).toBe("Email inválido");
      expect(errors.name).toBeUndefined();
    });

    it("Joi: deve filtrar erros para retornar apenas os presentes em scopeFields", async () => {
      const schema = Joi.object({
        name: Joi.string().min(5).messages({ "string.min": "Nome curto" }),
        email: Joi.string()
          .email()
          .messages({ "string.email": "Email inválido" }),
      });

      const resolver = joiResolver(schema);
      const errors = await resolver(invalidData as any, {
        scopeFields: ["name"],
      });

      expect(errors.name).toBe("Nome curto");
      expect(errors.email).toBeUndefined();
    });
  });

  describe("General Behavior", () => {
    it("Deve retornar objeto vazio quando os dados são válidos", async () => {
      const data = { email: "leo@test.com", age: 25 };
      const zodSchema = z.object({
        email: z.string().email(),
        age: z.number(),
      });

      const resolver = zodResolver(zodSchema);
      const errors = await resolver(data);

      expect(errors).toEqual({});
    });

    it("Deve capturar múltiplos erros simultâneos (abortEarly: false)", async () => {
      const schema = z.object({
        name: z.string().min(5, "Nome curto"),
        email: z.string().email("Email inválido"),
      });

      const resolver = zodResolver(schema);
      const errors = await resolver({ name: "Leo", email: "erro" } as any);

      expect(errors.name).toBe("Nome curto");
      expect(errors.email).toBe("Email inválido");
    });

    it("Deve lidar com campos opcionais ou ausentes sem quebrar", async () => {
      const schema = z.object({
        optionalField: z.string().optional(),
        requiredField: z
          .string({
            required_error: "Obrigatório",
          })
          .min(1, "Obrigatório"),
      });

      const resolver = zodResolver(schema);
      const errors = await resolver({} as any);

      expect(errors.requiredField).toBe("Obrigatório");
      expect(errors.optionalField).toBeUndefined();
    });
  });
});
