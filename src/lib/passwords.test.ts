import { describe, expect, it } from "vitest";

import { WEAK_BASE_COUNT, isCommonPassword, normalizePassword } from "@/lib/passwords";

describe("normalizePassword", () => {
  it("tira acento, maiúscula e separadores", () => {
    expect(normalizePassword("Senhá@Forte")).toBe("senhaforte");
  });

  it("descarta os dígitos colados nas pontas — é o disfarce mais comum", () => {
    expect(normalizePassword("2024password2024")).toBe("password");
    expect(normalizePassword("senha123456")).toBe("senha");
  });

  it("devolve vazio quando a senha é só número", () => {
    expect(normalizePassword("1234567890")).toBe("");
  });
});

describe("isCommonPassword", () => {
  it.each([
    ["senha123456", "base comum com dígitos"],
    ["password123", "clássica em inglês"],
    ["1234567890", "só dígitos"],
    ["aaaaaaaaaa", "um caractere repetido"],
    ["abcabcabcabc", "padrão curto repetido"],
    ["qwertyuiop", "fileira do teclado"],
    ["poiuytrewq", "fileira do teclado ao contrário"],
    ["Senha@2024", "senha brasileira com sufixo de ano"],
    ["affiliate123", "palavra do próprio site"],
    ["deusnocomando", "frase comum em português"],
    ["password!!", "base comum com sufixo curto"],
  ])("rejeita %s (%s)", (password) => {
    expect(isCommonPassword(password)).toBe(true);
  });

  it.each([
    "girassol-de-quarta",
    "MinhaFrase.Longa77",
    "trufaAzulNoTelhado",
    "kx8Vt2mQpLr9",
  ])("aceita %s", (password) => {
    expect(isCommonPassword(password)).toBe(false);
  });

  it("mantém uma lista de bases não trivial", () => {
    // Guarda contra alguém esvaziar a lista sem perceber.
    expect(WEAK_BASE_COUNT).toBeGreaterThan(150);
  });
});
