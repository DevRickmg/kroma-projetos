import { Badge } from "@/components/ui";
import type { Campaign } from "@/lib/types";

export function CampaignStatusBadge({ status }: { status: Campaign["status"] }) {
  switch (status) {
    case "running": return <Badge tone="cyan"><span className="size-1.5 rounded-full bg-cyan pulse-dot" /> Rodando</Badge>;
    case "paused": return <Badge tone="violet">Pausada</Badge>;
    case "completed": return <Badge tone="strong">Concluída</Badge>;
    case "cancelled": return <Badge>Cancelada</Badge>;
    default: return <Badge>Rascunho</Badge>;
  }
}

export const DEFAULT_TEMPLATES = [
  "{Oi|Olá}, tudo bem? Aqui é {{meu_nome}}, da {{minha_empresa}}. Vi a {{empresa}} no Google {aqui em|em} {{cidade|sua cidade}} e {fiquei com uma dúvida|queria te perguntar uma coisa}: vocês {já têm|têm} site próprio? Se não fizer sentido, é só me avisar que não chamo mais.",
  "{Oi|Olá}! Sou {{meu_nome}}, da {{minha_empresa}}. {Achei|Encontrei} a {{empresa}} {pesquisando|procurando} {{categoria|empresas}} em {{cidade|sua região}}. Hoje quem responde o WhatsApp de vocês é uma pessoa ou já tem algo automático? Se não for o momento, é só me avisar que não chamo mais.",
  "{Oi|Olá}, tudo certo? {{meu_nome}} aqui, da {{minha_empresa}}. Vi que a {{empresa}} tem {{avaliacoes|várias}} avaliações no Google, {parabéns|muito bom}. Posso te mandar uma ideia rápida de como transformar essas buscas em mais clientes? Se não fizer sentido, é só me avisar que não chamo mais.",
  "{Oi|Olá}, tudo bem? Aqui é {{meu_nome}}, da {{minha_empresa}}. Monto site e atendimento automático no WhatsApp pra {{categoria|negócios}}, com valor fechado e sem mensalidade. Posso te fazer uma pergunta rápida sobre a {{empresa}}? Se não for o momento, é só me avisar que não chamo mais.",
  "{Oi|Olá|Opa}! {{meu_nome}}, da {{minha_empresa}}. {Vi a|Passei pela} página da {{empresa}} no Google Maps. Quando alguém procura vocês {fora do horário|à noite}, tem como pedir orçamento sozinho? Se não fizer sentido, é só me avisar que não chamo mais.",
];
