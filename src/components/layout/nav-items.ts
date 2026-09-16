import {
  BarChart3,
  FileImage,
  Home,
  Link2,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Terminal,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  /** Título do grupo na sidebar do admin; sem título o grupo não é rotulado. */
  title?: string;
  items: NavItem[];
};

/**
 * Navegação do afiliado: bottom nav no celular, sidebar no desktop
 * (docs/spec/05, seção Layout). As rotas ainda são placeholders nesta fatia.
 */
export const AFFILIATE_NAV: NavItem[] = [
  { href: "/painel", label: "Início", icon: Home },
  { href: "/painel/links", label: "Links", icon: Link2 },
  { href: "/painel/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/painel/materiais", label: "Materiais", icon: FileImage },
  { href: "/painel/perfil", label: "Perfil", icon: User },
];

/** Navegação do admin, agrupada como na spec. */
export const ADMIN_NAV: NavGroup[] = [
  {
    items: [{ href: "/admin", label: "Visão geral", icon: BarChart3 }],
  },
  {
    title: "Programa",
    items: [
      { href: "/admin/afiliados", label: "Afiliados", icon: Users },
      { href: "/admin/produtos", label: "Produtos", icon: Package },
      { href: "/admin/materiais", label: "Materiais", icon: FileImage },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/admin/vendas", label: "Vendas", icon: ShoppingCart },
      { href: "/admin/comissoes", label: "Comissões", icon: Receipt },
      { href: "/admin/pagamentos", label: "Pagamentos", icon: Wallet },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
      { href: "/admin/sistema", label: "Sistema", icon: Terminal },
    ],
  },
];

/**
 * Um item está ativo se a rota é exatamente ele ou um filho dele.
 * A raiz de cada área (`/painel`, `/admin`) exige correspondência exata, senão
 * ficaria sempre acesa.
 */
export function isNavItemActive(pathname: string, href: string, exactRoots: string[]): boolean {
  if (exactRoots.includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
