/**
 * Checagem de senha comum.
 *
 * Como `minPasswordLength` é 10 (docs/spec/04), quase toda a lista clássica de
 * "top 1000 senhas" já é barrada pelo tamanho — a esmagadora maioria tem 6 a 9
 * caracteres. O que passa do filtro de tamanho são variações: a senha comum com
 * dígitos colados no fim (`senha123456`), repetição (`abcabcabcabc`), sequências
 * de teclado e o nome do próprio site.
 *
 * Por isso a checagem combina duas coisas:
 *
 * 1. uma lista das bases mais frequentes (inclusive as brasileiras, que não
 *    aparecem nas listas em inglês);
 * 2. regras sobre o formato — repetição, sequência numérica, sequência de teclado.
 *
 * A comparação é feita sobre a senha **normalizada** (minúsculas, sem acento,
 * sem separadores e sem os dígitos/símbolos colados nas pontas), porque é assim
 * que as pessoas disfarçam uma senha fraca.
 *
 * Funções puras: nada aqui toca banco, rede ou `process.env`.
 */

/**
 * Bases de senha mais frequentes (listas públicas de vazamentos + as brasileiras
 * mais comuns). Guardadas como base: `senha` cobre `senha123`, `Senha@2024` etc.
 */
const COMMON_BASES = `
password senha senha123 passwd pass123 123456 1234567 12345678 123456789 1234567890
qwerty qwertyui qwertyuiop asdfgh asdfghjk asdfghjkl zxcvbn zxcvbnm 1qaz2wsx qazwsx
abc123 abcd1234 a1b2c3d4 letmein welcome welcome1 admin administrador administrator
iloveyou loveyou princess sunshine dragon monkey shadow master superman batman
football baseball basketball soccer futebol flamengo corinthians palmeiras saopaulo
vasco gremio internacional cruzeiro atletico botafogo fluminense santos bahia sport
brasil brazil brasil123 riodejaneiro saopaulo1 curitiba salvador fortaleza recife
familia amor amor123 amordaminhavida deusefiel deusnocomando jesus jesuscristo
jesusteama deusemaior sodeus gracasadeus felicidade liberdade esperanca saudade
mudar123 mudar mudarsenha trocar123 alterar123 novasenha minhasenha suasenha
teste testando teste123 exemplo usuario usuario123 cliente cliente123 acesso
default padrao padrao123 sistema sistema123 empresa empresa123 trabalho escritorio
computador celular internet facebook instagram whatsapp youtube google gmail hotmail
casadapraia casanova meuamor meufilho minhafilha meucachorro meugato
naosei naoseiasenha esqueci esqueciasenha lembrar
qwerty123 qwerty1234 qwertyu123 password1 password12 password123 password1234
p@ssword p@ssw0rd pa55word senha@123 senha1234 senha12345 senha@2024 senha@2025
admin123 admin1234 admin@123 root123 root1234 toor1234 guest123 test1234
freedom whatever trustno1 starwars pokemon nintendo playstation minecraft
liverpool chelsea arsenal barcelona realmadrid juventus milan
michael jennifer jessica charlie thomas daniel joshua matthew andrew
maria maria123 joao joao123 ana ana12345 pedro pedro123 lucas lucas123
gabriel gabriel123 rafael rafael123 juliana juliana123 fernanda mariana
carlos carlos123 paulo paulo123 marcos marcos123 bruno bruno123 felipe
amanda amanda123 leticia larissa camila beatriz vitoria isabela
gostosa gatinha gatinho amoreterno amordeverdade coracao anjinho
aniversario casamento formatura natal2024 natal2025 anonovo carnaval
seguranca segredo secreta confidencial privado pessoal particular
dinheiro riqueza sucesso vencedor campeao numerouno primeiro
`
  .split(/\s+/)
  .filter((entry) => entry.length > 0);

const COMMON_BASE_SET = new Set(COMMON_BASES);

/** Sequências de teclado e de dígitos que aparecem em senha "criada com pressa". */
const KEYBOARD_ROWS = [
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "0123456789",
  "abcdefghijklmnopqrstuvwxyz",
];

/** Palavras do próprio produto: quem cadastra aqui tende a usá-las. */
const SITE_WORDS = ["affiliate", "affiliatetool", "afiliado", "afiliados"];

/** Tudo que a checagem considera "base fraca": lista pública + palavras do site. */
const WEAK_BASES = [...COMMON_BASES, ...SITE_WORDS];

/**
 * Reduz a senha ao seu núcleo: minúsculas, sem acento, sem separadores e sem os
 * dígitos e símbolos colados nas pontas. `Senha@2024!` → `senha`.
 */
export function normalizePassword(password: string): string {
  return password
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento separadas pelo NFD
    .toLowerCase()
    .replace(/[\s._\-@#!$%*+]/g, "")
    .replace(/^[0-9]+|[0-9]+$/g, "");
}

/** Uma única letra ou dígito repetido do começo ao fim (`aaaaaaaaaa`). */
function isSingleCharRepeat(value: string): boolean {
  return value.length > 0 && /^(.)\1+$/.test(value);
}

/** O mesmo pedaço curto repetido até formar a senha (`abcabcabcabc`). */
function isShortPatternRepeat(value: string): boolean {
  for (let size = 1; size <= Math.floor(value.length / 2); size += 1) {
    if (value.length % size !== 0) continue;
    const chunk = value.slice(0, size);
    if (chunk.repeat(value.length / size) === value) return true;
  }
  return false;
}

/** Trecho contínuo de uma fileira do teclado ou do alfabeto, em qualquer sentido. */
function isKeyboardRun(value: string): boolean {
  if (value.length < 4) return false;
  const reversed = Array.from(value).reverse().join("");

  return KEYBOARD_ROWS.some((row) => row.includes(value) || row.includes(reversed));
}

/**
 * `true` quando a senha é comum demais para proteger uma conta.
 *
 * Não substitui o tamanho mínimo — é a checagem seguinte, sobre senhas que já
 * têm 10 caracteres mas nenhum segredo de verdade.
 */
export function isCommonPassword(password: string): boolean {
  const raw = password.toLowerCase();
  const normalized = normalizePassword(password);

  if (normalized.length === 0) return true; // só dígitos: `1234567890`
  if (isSingleCharRepeat(normalized) || isShortPatternRepeat(normalized)) return true;
  if (isKeyboardRun(raw) || isKeyboardRun(normalized)) return true;
  if (COMMON_BASE_SET.has(raw) || COMMON_BASE_SET.has(normalized)) return true;

  // Base fraca com sufixo curto colado (`password!!`, `affiliatezz`): o que sobra
  // depois de tirar a base não acrescenta segredo nenhum.
  return WEAK_BASES.some(
    (base) =>
      base.length >= 5 && normalized.startsWith(base) && normalized.length - base.length <= 2,
  );
}

/** Quantidade de bases fracas conhecidas — usada nos testes e na documentação. */
export const WEAK_BASE_COUNT = new Set(WEAK_BASES).size;
