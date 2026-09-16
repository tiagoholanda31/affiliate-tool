import { describe, expect, it } from "vitest";

import {
  applyCnpjMask,
  applyCpfCnpjMask,
  applyCpfMask,
  applyMask,
  applyMoneyMask,
  applyPhoneMask,
  isValidCnpj,
  isValidCpf,
  isValidPhone,
  onlyDigits,
  unmask,
  unmaskMoney,
} from "@/lib/masks";

describe("applyCpfMask", () => {
  it("formata progressivamente enquanto o usuário digita", () => {
    expect(applyCpfMask("123")).toBe("123");
    expect(applyCpfMask("1234")).toBe("123.4");
    expect(applyCpfMask("1234567")).toBe("123.456.7");
    expect(applyCpfMask("12345678909")).toBe("123.456.789-09");
  });

  it("ignora o que não for dígito e trunca o excesso", () => {
    expect(applyCpfMask("abc123def456ghi789jkl09")).toBe("123.456.789-09");
    expect(applyCpfMask("123456789091234")).toBe("123.456.789-09");
  });
});

describe("applyCnpjMask", () => {
  it("formata progressivamente", () => {
    expect(applyCnpjMask("12")).toBe("12");
    expect(applyCnpjMask("12345")).toBe("12.345");
    expect(applyCnpjMask("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("trunca em 14 dígitos", () => {
    expect(applyCnpjMask("123456780001909999")).toBe("12.345.678/0001-90");
  });
});

describe("applyCpfCnpjMask", () => {
  it("escolhe o formato pela quantidade de dígitos", () => {
    expect(applyCpfCnpjMask("12345678909")).toBe("123.456.789-09");
    expect(applyCpfCnpjMask("12345678000190")).toBe("12.345.678/0001-90");
  });
});

describe("applyPhoneMask", () => {
  it("formata celular com 11 dígitos", () => {
    expect(applyPhoneMask("11987654321")).toBe("(11) 98765-4321");
  });

  it("formata fixo com 10 dígitos", () => {
    expect(applyPhoneMask("1134567890")).toBe("(11) 3456-7890");
  });

  it("formata progressivamente", () => {
    expect(applyPhoneMask("1")).toBe("(1");
    expect(applyPhoneMask("11")).toBe("(11");
    expect(applyPhoneMask("1198")).toBe("(11) 98");
    expect(applyPhoneMask("11987654")).toBe("(11) 9876-54");
  });

  it("trunca em 11 dígitos", () => {
    expect(applyPhoneMask("119876543219999")).toBe("(11) 98765-4321");
  });
});

describe("applyMoneyMask", () => {
  it("preenche da direita para a esquerda", () => {
    expect(applyMoneyMask("1")).toBe("0,01");
    expect(applyMoneyMask("12")).toBe("0,12");
    expect(applyMoneyMask("123")).toBe("1,23");
    expect(applyMoneyMask("1234")).toBe("12,34");
    expect(applyMoneyMask("123456")).toBe("1.234,56");
  });

  it("devolve vazio para entrada vazia — não força 0,00 no campo", () => {
    expect(applyMoneyMask("")).toBe("");
    expect(applyMoneyMask("abc")).toBe("");
  });

  it("aceita reformatar um valor já mascarado", () => {
    expect(applyMoneyMask("1.234,56")).toBe("1.234,56");
  });
});

describe("unmask", () => {
  it("devolve só dígitos para documentos e telefone", () => {
    expect(unmask("cpf", "123.456.789-09")).toBe("12345678909");
    expect(unmask("cnpj", "12.345.678/0001-90")).toBe("12345678000190");
    expect(unmask("phone", "(11) 98765-4321")).toBe("11987654321");
  });

  it("devolve centavos para moeda", () => {
    expect(unmask("money", "1.234,56")).toBe("123456");
    expect(unmaskMoney("R$ 89,90")).toBe(8990);
    expect(unmaskMoney("")).toBe(0);
  });
});

describe("applyMask", () => {
  it("despacha para a máscara certa", () => {
    expect(applyMask("cpf", "12345678909")).toBe("123.456.789-09");
    expect(applyMask("phone", "11987654321")).toBe("(11) 98765-4321");
    expect(applyMask("money", "123456")).toBe("1.234,56");
    expect(applyMask("cpfCnpj", "12345678000190")).toBe("12.345.678/0001-90");
  });
});

describe("onlyDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(onlyDigits("(11) 98765-4321")).toBe("11987654321");
    expect(onlyDigits("abc")).toBe("");
  });
});

describe("isValidCpf", () => {
  it("aceita CPFs válidos, com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.444.777-30")).toBe(false);
  });

  it("recusa tamanho errado e sequências repetidas", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("000.000.000-00")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJs válidos", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("recusa dígito verificador errado e sequências repetidas", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("aceita fixo e celular com DDD", () => {
    expect(isValidPhone("(11) 98765-4321")).toBe(true);
    expect(isValidPhone("(11) 3456-7890")).toBe(true);
  });

  it("recusa DDD inválido, tamanho errado e celular sem o 9", () => {
    expect(isValidPhone("(01) 98765-4321")).toBe(false);
    expect(isValidPhone("987654321")).toBe(false);
    expect(isValidPhone("(11) 88765-4321")).toBe(false);
  });
});
