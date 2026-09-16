"use client";

/**
 * Erro no próprio layout raiz. Precisa trazer `<html>` e `<body>` porque
 * substitui o layout inteiro — por isso não usa nenhum componente do app.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          minHeight: "100dvh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          background: "#f0f2f4",
          color: "#00172d",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Algo deu errado</h1>
        <p style={{ fontSize: "0.875rem" }}>
          Não conseguimos carregar a aplicação. Tente novamente em instantes.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", opacity: 0.7 }}>Referência: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: "0.75rem",
            background: "#00172d",
            color: "#fff",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
