import { describe, expect, it } from "vitest";

import {
  decrypt,
  decryptWithKey,
  encrypt,
  encryptWithKey,
  hashToken,
  maskCpf,
  maskEmail,
  maskPixKey,
  randomToken,
  safeCompare,
  sha256,
} from "@/lib/crypto";

describe("encrypt / decrypt", () => {
  it("faz ida e volta preservando o texto", () => {
    const plain = "12345678909";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("preserva acentos e emoji", () => {
    const plain = "Chave Pix: joão@instituto.com 🔐";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("preserva string vazia", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("gera texto cifrado diferente a cada chamada (IV aleatório)", () => {
    const plain = "12345678909";
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it("marca a versão do formato para permitir rotação futura", () => {
    expect(encrypt("x").startsWith("v1.")).toBe(true);
  });

  it("recusa payload adulterado — GCM autentica o conteúdo", () => {
    const payload = encrypt("12345678909");
    const parts = payload.split(".");
    const tampered = [parts[0], parts[1], parts[2], "AAAA" + String(parts[3])].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("recusa payload em formato inválido", () => {
    expect(() => decrypt("não-é-payload")).toThrow(/formato inválido/i);
    expect(() => decrypt("v1.a.b")).toThrow(/formato inválido/i);
  });

  it("recusa versão desconhecida", () => {
    const payload = encrypt("x").replace(/^v1\./, "v9.");
    expect(() => decrypt(payload)).toThrow(/não suportada/i);
  });

  it("encryptWithKey / decryptWithKey rotacionam entre duas chaves", () => {
    const keyA = Buffer.alloc(32, 1).toString("base64");
    const keyB = Buffer.alloc(32, 2).toString("base64");
    const cipher = encryptWithKey("segredo-pix", keyA);
    expect(decryptWithKey(cipher, keyA)).toBe("segredo-pix");
    expect(() => decryptWithKey(cipher, keyB)).toThrow();
  });
});

describe("sha256 / hashToken", () => {
  it("produz hash hexadecimal estável de 64 caracteres", () => {
    const hash = sha256("affiliate");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256("affiliate")).toBe(hash);
  });

  it("hashToken é determinístico e diferente do token", () => {
    const token = randomToken(16);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});

describe("randomToken", () => {
  it("gera tokens únicos em base64url (seguro em URL)", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => randomToken(16)));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe("safeCompare", () => {
  it("compara strings iguais e diferentes", () => {
    expect(safeCompare("segredo", "segredo")).toBe(true);
    expect(safeCompare("segredo", "segred0")).toBe(false);
  });

  it("não estoura com tamanhos diferentes", () => {
    expect(safeCompare("curto", "bem mais longo")).toBe(false);
  });
});

describe("maskPixKey", () => {
  it("mascara CPF mantendo o miolo reconhecível", () => {
    expect(maskPixKey("123.456.789-09", "CPF")).toBe("***.456.789-**");
    expect(maskPixKey("12345678909", "CPF")).toBe("***.456.789-**");
  });

  it("mascara CNPJ", () => {
    expect(maskPixKey("12.345.678/0001-90", "CNPJ")).toBe("**.345.678/0001-**");
  });

  it("mascara e-mail preservando o domínio", () => {
    expect(maskPixKey("maria@exemplo.com", "EMAIL")).toBe("ma***@exemplo.com");
    expect(maskEmail("a@exemplo.com")).toBe("a***@exemplo.com");
  });

  it("mascara telefone mostrando DDD e os 4 últimos", () => {
    expect(maskPixKey("+5511987654321", "PHONE")).toBe("(11) *****-4321");
    expect(maskPixKey("(11) 98765-4321", "PHONE")).toBe("(11) *****-4321");
  });

  it("mascara chave aleatória mostrando só as pontas", () => {
    expect(maskPixKey("9f2c1e4a-1234-5678-9abc-def012a17b45", "RANDOM")).toBe("9f2c…7b45");
  });

  it("cai no formato genérico quando o valor não bate com o tipo", () => {
    expect(maskPixKey("123", "CPF")).toBe("****");
    expect(maskCpf("abc")).toBe("****");
  });

  it("nunca devolve o valor original completo", () => {
    const casos = [
      ["12345678909", "CPF"],
      ["12345678000190", "CNPJ"],
      ["maria@exemplo.com", "EMAIL"],
      ["+5511987654321", "PHONE"],
      ["9f2c1e4a-1234-5678-9abc-def012a17b45", "RANDOM"],
    ] as const;

    for (const [value, type] of casos) {
      const masked = maskPixKey(value, type);
      expect(masked).not.toBe(value);
      // Sempre há elisão: `*` nos formatos com dígitos, `…` na chave aleatória.
      expect(masked).toMatch(/[*…]/);
    }
  });
});
