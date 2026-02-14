import { ObjectSchema } from "joi";
import { BitErrors } from "../core/store/types";

export const joiResolver = <T extends object>(schema: ObjectSchema<T>) => {
  return async (
    values: T,
    options?: { scopeFields?: string[] },
  ): Promise<BitErrors<T>> => {
    // Para validação parcial, o Joi precisa ignorar campos desconhecidos no objeto de valores
    const { error } = schema.validate(values, {
      abortEarly: false,
      allowUnknown: true,
    });

    if (!error) return {};

    const errors: BitErrors<T> = {};

    error.details.forEach((detail) => {
      const path = detail.path.join(".");

      // Se houver campos alvo, filtramos o erro. Caso contrário, pega tudo.
      if (options?.scopeFields) {
        if (options.scopeFields.includes(path) && !errors[path]) {
          errors[path] = detail.message;
        }
      } else if (path && !errors[path]) {
        errors[path] = detail.message;
      }
    });

    return errors;
  };
};
