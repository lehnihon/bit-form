import React, { useMemo, useState } from "react";
import { createBitStore } from "../../../../../src/core";
import {
  BitFormProvider,
  useBitArray,
  useBitField,
  useBitForm,
  useBitPersist,
} from "../../../../../src/react";

type PilotForm = {
  name: string;
  email: string;
  username: string;
  tags: string[];
};

function PilotFormScreen() {
  const form = useBitForm<PilotForm>();
  const persist = useBitPersist();
  const name = useBitField<PilotForm, "name">("name");
  const email = useBitField<PilotForm, "email">("email");
  const username = useBitField<PilotForm, "username">("username");
  const tags = useBitArray<PilotForm, "tags">("tags");
  const [nextTag, setNextTag] = useState("");

  const handleSubmit = form.onSubmit(async (values) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (values.email === "server@error.com") {
      throw {
        errors: {
          email: "Email rejeitado pelo servidor",
        },
      };
    }
    return { ok: true };
  });

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 8, maxWidth: 420 }}
    >
      <label>
        Nome
        <input data-testid="name-input" {...name.props} />
      </label>

      <label>
        Email
        <input data-testid="email-input" {...email.props} />
      </label>
      {email.meta.invalid && (
        <span data-testid="email-error">{email.meta.error}</span>
      )}

      <label>
        Username
        <input data-testid="username-input" {...username.props} />
      </label>
      {username.meta.invalid && (
        <span data-testid="username-error">{username.meta.error}</span>
      )}

      <div>
        <input
          data-testid="tag-input"
          value={nextTag}
          onChange={(event) => setNextTag(event.target.value)}
          placeholder="Tag"
        />
        <button
          data-testid="add-tag"
          type="button"
          onClick={() => {
            if (!nextTag.trim()) return;
            tags.append(nextTag.trim());
            setNextTag("");
          }}
        >
          Add Tag
        </button>
      </div>

      <ul data-testid="tags-list">
        {tags.fields.map((item) => (
          <li key={item.key} data-testid={`tag-${item.index}`}>
            {item.value}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          data-testid="save-draft"
          type="button"
          onClick={() => persist.save()}
        >
          Save Draft
        </button>
        <button
          data-testid="restore-draft"
          type="button"
          onClick={() => persist.restore()}
        >
          Restore Draft
        </button>
        <button
          data-testid="clear-draft"
          type="button"
          onClick={() => persist.clear()}
        >
          Clear Draft
        </button>
      </div>

      <div data-testid="persist-meta">
        {String(persist.meta.isSaving)}|{String(persist.meta.isRestoring)}|
        {persist.meta.error?.message ?? "ok"}
      </div>

      <button
        data-testid="submit-button"
        type="submit"
        disabled={form.meta.isSubmitting}
      >
        Submit
      </button>
    </form>
  );
}

export function App() {
  const store = useMemo(
    () =>
      createBitStore<PilotForm>({
        name: "quality-e2e",
        initialValues: {
          name: "",
          email: "",
          username: "",
          tags: [],
        },
        persist: {
          enabled: true,
          key: "quality-e2e-persist",
          autoSave: false,
        },
        validation: {
          resolver: (values) => {
            const errors: Record<string, string | undefined> = {};
            if (!values.name.trim()) errors.name = "Nome obrigatório";
            if (!values.email.trim()) errors.email = "Email obrigatório";
            return errors;
          },
          delay: 10,
        },
        fields: {
          username: {
            validation: {
              asyncValidateDelay: 30,
              asyncValidate: async (value) => {
                await new Promise((resolve) => setTimeout(resolve, 30));
                if (String(value).toLowerCase() === "admin") {
                  return "Username já está em uso";
                }
                return undefined;
              },
            },
          },
        },
      }),
    [],
  );

  return (
    <BitFormProvider store={store}>
      <PilotFormScreen />
    </BitFormProvider>
  );
}
