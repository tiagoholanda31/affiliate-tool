import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  registerAffiliateSchema,
  socialHandleSchema,
  socialNetworkSchema,
  validatePixKey,
} from "@/features/affiliates/schemas";

describe("phoneSchema", () => {
  it("converte celular com máscara para E.164", () => {
    expect(phoneSchema.parse("(11) 98765-4321")).toBe("+5511987654321");
  });

  it("aceita o 55 que a pessoa já digitou, sem duplicar", () => {
    expect(phoneSchema.parse("5511987654321")).toBe("+5511987654321");
    expect(phoneSchema.parse("+55 11 98765-4321")).toBe("+5511987654321");
  });

  it("aceita fixo de 10 dígitos", () => {
    expect(phoneSchema.parse("1134567890")).toBe("+551134567890");
  });

  it.each([
    ["119876543", "curto demais"],
    ["0198765432", "DDD inválido"],
    ["11887654321", "celular sem o 9"],
  ])("rejeita %s (%s)", (input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

describe("socialHandleSchema", () => {
  it("remove o @ do começo", () => {
    expect(socialHandleSchema.parse("@maria.afiliada")).toBe("maria.afiliada");
  });

  it("extrai o usuário de um link colado", () => {
    expect(socialHandleSchema.parse("https://www.instagram.com/maria.afiliada/")).toBe("maria.afiliada");
  });

  it("rejeita caracteres que rede social nenhuma aceita", () => {
    expect(socialHandleSchema.safeParse("maria psi").success).toBe(false);
    expect(socialHandleSchema.safeParse("m").success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("normaliza espaços e caixa", () => {
    expect(emailSchema.parse("  Maria@Exemplo.COM ")).toBe("maria@exemplo.com");
  });

  it("rejeita endereço inválido", () => {
    expect(emailSchema.safeParse("maria@").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("exige 10 caracteres", () => {
    expect(passwordSchema.safeParse("curta1234").success).toBe(false);
  });

  it("rejeita senha comum mesmo com o tamanho certo", () => {
    const result = passwordSchema.safeParse("senha123456");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("muito comum");
  });

  it("aceita uma senha longa e específica", () => {
    expect(passwordSchema.safeParse("trufaAzulNoTelhado").success).toBe(true);
  });
});

describe("socialNetworkSchema", () => {
  it("aceita um valor do enum", () => {
    expect(socialNetworkSchema.parse("INSTAGRAM")).toBe("INSTAGRAM");
  });

  it("trata o campo vazio como 'ainda não escolheu'", () => {
    const result = socialNetworkSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Escolha uma rede social.");
  });
});

describe("validatePixKey", () => {
  it("aceita CPF válido e normaliza para dígitos", () => {
    expect(validatePixKey("CPF", "529.982.247-25")).toEqual({ ok: true, value: "52998224725" });
  });

  it("rejeita CPF com dígito verificador errado", () => {
    const result = validatePixKey("CPF", "529.982.247-26");
    expect(result).toEqual({ ok: false, message: "CPF inválido." });
  });

  it("rejeita CPF de dígitos repetidos, que passa no cálculo ingênuo", () => {
    expect(validatePixKey("CPF", "111.111.111-11").ok).toBe(false);
  });

  it("aceita CNPJ válido e normaliza", () => {
    expect(validatePixKey("CNPJ", "11.222.333/0001-81")).toEqual({
      ok: true,
      value: "11222333000181",
    });
  });

  it("rejeita CNPJ com DV errado", () => {
    expect(validatePixKey("CNPJ", "11.222.333/0001-82").ok).toBe(false);
  });

  it("normaliza chave de e-mail para minúsculas", () => {
    expect(validatePixKey("EMAIL", " Maria@Exemplo.com ")).toEqual({
      ok: true,
      value: "maria@exemplo.com",
    });
  });

  it("converte chave de telefone para E.164", () => {
    expect(validatePixKey("PHONE", "(11) 98765-4321")).toEqual({
      ok: true,
      value: "+5511987654321",
    });
  });

  it("aceita chave aleatória em formato UUID", () => {
    const uuid = "9F2C4A1B-7D3E-4C5A-8B6D-1E2F3A4B5C6D";
    expect(validatePixKey("RANDOM", uuid)).toEqual({
      ok: true,
      value: uuid.toLowerCase(),
    });
  });

  it("rejeita chave aleatória fora do formato", () => {
    expect(validatePixKey("RANDOM", "9f2c4a1b7d3e4c5a8b6d1e2f3a4b5c6d").ok).toBe(false);
  });
});

describe("registerAffiliateSchema", () => {
  const base = {
    name: "Maria Souza",
    email: "maria@exemplo.com",
    password: "trufaAzulNoTelhado",
    phone: "11987654321",
    socialNetwork: "INSTAGRAM",
    socialHandle: "@maria.afiliada",
    pixKeyType: "CPF",
    pixKey: "529.982.247-25",
    termsAccepted: true,
    website: "",
    startedAt: 1_700_000_000_000,
  };

  it("normaliza tudo de uma vez", () => {
    const parsed = registerAffiliateSchema.parse(base);

    expect(parsed.phone).toBe("+5511987654321");
    expect(parsed.socialHandle).toBe("maria.afiliada");
    expect(parsed.pixKey).toBe("52998224725");
    expect(parsed.email).toBe("maria@exemplo.com");
  });

  it("aponta o erro da chave Pix no campo pixKey, não no tipo", () => {
    const result = registerAffiliateSchema.safeParse({ ...base, pixKey: "529.982.247-26" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "pixKey")).toBe(true);
  });

  it("exige o aceite dos termos", () => {
    const result = registerAffiliateSchema.safeParse({ ...base, termsAccepted: false });
    expect(result.success).toBe(false);
  });

  it("rejeita o honeypot preenchido — só robô encosta nele", () => {
    const result = registerAffiliateSchema.safeParse({ ...base, website: "http://spam.example" });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("exige que a confirmação bata", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "qualquer",
      newPassword: "trufaAzulNoTelhado",
      confirmPassword: "trufaAzulNoTelhad",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
