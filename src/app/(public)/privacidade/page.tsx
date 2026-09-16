import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Política de Privacidade" };

/**
 * Política de privacidade.
 *
 * Texto provisório: o definitivo deve ser substituído pelo jurídico do operador,
 * registrada em docs/PROGRESS.md). O que está aqui descreve com honestidade o
 * que o sistema realmente faz com os dados hoje — não é texto genérico copiado.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader
        title="Política de Privacidade"
        eyebrow="Versão provisória"
        description="Como tratamos os dados de quem participa do Programa de Afiliados."
      />

      <div className="space-y-6 rounded-lg bg-white p-6 text-sm leading-6 text-navy-700 shadow-card sm:p-8">
        <section className="space-y-2">
          <h2 className="font-display text-lg text-navy-900">Quais dados coletamos</h2>
          <p>
            No cadastro de afiliado: nome, e-mail, celular, rede social e chave Pix. Nas vendas:
            nome, e-mail e, quando o pagamento exige, o documento do comprador. Registramos também o
            IP e a data em que você aceitou os termos do programa.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-navy-900">Para que usamos</h2>
          <p>
            Para operar o programa: identificar suas indicações, calcular e pagar comissões, entregar
            os materiais digitais comprados e falar com você sobre o seu cadastro. Não vendemos nem
            cedemos seus dados a terceiros para publicidade.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-navy-900">Como protegemos</h2>
          <p>
            A chave Pix e o documento do comprador ficam criptografados no banco de dados e aparecem
            mascarados nas telas. As senhas são guardadas como hash, nunca em texto. Dados de cartão
            não passam pelos nossos servidores: vão direto do seu navegador para o Pagar.me.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-navy-900">Por quanto tempo guardamos</h2>
          <p>
            Registros de clique por 13 meses. Pedidos e comissões pelo prazo contábil exigido por lei.
            Afiliados removidos têm os dados pessoais anonimizados após 30 dias — o histórico
            financeiro permanece, sem identificação pessoal.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg text-navy-900">Seus direitos</h2>
          <p>
            Você pode acessar e corrigir seus dados na tela de perfil, e pedir a remoção da conta a
            qualquer momento. Para exercer qualquer outro direito da LGPD, fale com o suporte
            pelos canais de contato.
          </p>
        </section>
      </div>
    </article>
  );
}
