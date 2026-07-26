import type { Locale } from "./locale";

const englishMessages: Record<string, string> = {
  "Database is not available": "The database is not available.",
  "Muitas solicitações recentes. Tente novamente mais tarde.":
    "Too many recent requests. Please try again later.",
  "O conjunto de certificados deve ter no máximo 40 MB.":
    "The combined certificates must be no larger than 40 MB.",
  "Revise os campos destacados.": "Review the highlighted fields.",
  "Formato de certificado não permitido.":
    "Unsupported certificate format.",
  "O certificado deve ter no máximo 10 MB.":
    "Each certificate must be no larger than 10 MB.",
  "O certificado precisa ser um PDF, JPG, PNG ou WebP válido.":
    "Each certificate must be a valid PDF, JPG, PNG or WebP file.",
  "A lista de certificados não corresponde aos arquivos enviados.":
    "The certificate list does not match the uploaded files.",
  "Informe seu nome completo.": "Enter your full name.",
  "Informe um e-mail válido.": "Enter a valid email address.",
  "Informe quem concedeu sua faixa-preta.": "Enter the person who awarded your black belt.",
  "Selecione um professor que já esteja na árvore.":
    "Select an instructor who is already in the tree.",
  "O mesmo professor não pode ser selecionado duas vezes.":
    "The same instructor cannot be selected twice.",
  "Use a conexão conjunta quando houver mais de um professor.":
    "Use a joint connection when there is more than one instructor.",
  "Selecione ao menos dois professores para uma graduação conjunta.":
    "Select at least two instructors for a joint promotion.",
  "Um dos professores selecionados não existe ou ainda não faz parte da árvore pública.":
    "One of the selected instructors does not exist or is not yet part of the public tree.",
  "Selecione um país válido.": "Select a valid country.",
  "Informe uma data válida.": "Enter a valid date.",
  "Cada evidência deve ser um link válido.": "Each item of evidence must be a valid link.",
  "É necessário autorizar a análise editorial dos dados enviados.":
    "You must authorize the editorial review of the submitted data.",
  "Cada arquivo de certificado deve aparecer uma única vez.":
    "Each certificate file must appear only once.",
  "Envie somente um certificado consolidado por faixa ou grupo de faixa.":
    "Upload only one consolidated certificate per belt or belt group.",
  "A sequência dos certificados não pode conter etapas repetidas.":
    "The certificate sequence cannot contain repeated steps.",
  "Todos os certificados devem pertencer à trajetória selecionada.":
    "Every certificate must belong to the selected journey.",
  "As graduações infantis e juvenis exigem a trajetória iniciada jovem.":
    "Youth ranks require the youth-start journey.",
  "Confirme que todos os certificados recebidos foram incluídos.":
    "Confirm that every certificate you received has been included.",
  "Inclua ao menos um link ou explique a promoção com um pouco mais de detalhe.":
    "Include at least one link or explain the promotion in a little more detail.",
  "Resposta inválida da API.": "Invalid response from the API.",
  "Não foi possível enviar sua solicitação.": "Your request could not be submitted.",
  "Erro desconhecido": "Unknown error"
};

const beltNames: Record<string, string> = {
  azul: "blue",
  roxa: "purple",
  marrom: "brown",
  preta: "black"
};

export function translateJoinApiMessage(message: string, locale: Locale) {
  if (locale === "pt") return message;
  const exact = englishMessages[message];
  if (exact) return exact;

  const missing = message.match(/^Envie os certificados obrigatórios: (.+)\.$/);
  if (missing) {
    const ranks = missing[1]
      .split(",")
      .map((rank) => beltNames[rank.trim()] ?? rank.trim())
      .join(", ");
    return `Upload the required certificates: ${ranks}.`;
  }

  const absent = message.match(/^Certificado ausente para a faixa (.+)\.$/);
  if (absent) return `Certificate missing for ${absent[1]}.`;
  return message;
}

export function translateJoinApiPayload(payload: unknown, locale: Locale): unknown {
  if (locale === "pt" || !payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) {
    return payload.map((value) =>
      typeof value === "string" ? translateJoinApiMessage(value, locale) : value
    );
  }

  const source = payload as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => {
      if (typeof value === "string" && (key === "error" || key === "detail")) {
        return [key, translateJoinApiMessage(value, locale)];
      }
      if (key === "fields" && value && typeof value === "object") {
        const fields = value as Record<string, unknown>;
        return [
          key,
          Object.fromEntries(
            Object.entries(fields).map(([field, messages]) => [
              field,
              Array.isArray(messages)
                ? messages.map((message) =>
                    typeof message === "string"
                      ? translateJoinApiMessage(message, locale)
                      : message
                  )
                : messages
            ])
          )
        ];
      }
      return [key, value];
    })
  );
}
