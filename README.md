# AION 2 — Guias em português do Brasil

[Abrir o site](https://aion2-guias-br.juniorikkix.chatgpt.site/pt-BR/) · [Repositório desta edição](https://github.com/juniorikkiz3/aion2-guias-pt-br)

Manutenção configurada no Codex a cada três dias, às 09:00 de Brasília. Ela verifica a fonte, traduz e revisa as mudanças, valida o resultado e publica no mesmo site e neste GitHub. A execução usa este computador: ele precisa estar ligado com o Codex aberto. O procedimento e as verificações estão em [MAINTENANCE.md](MAINTENANCE.md). O repositório público não muda o acesso do site hospedado.

Versão independente baseada em https://aion2-guides.info/en/ (Couga54 / AION 2 Guides).

Sincronizada em 19/10/2026 com a versão da fonte atualizada até 19/10/2026. O repositório público anterior deixou de receber as mudanças de conteúdo após 10/10. Por isso, esta atualização usa uma captura das páginas públicas do novo domínio.

## Conteúdo

- 20 páginas em PT-BR: início, oito classes e onze páginas de guias/ferramentas, incluindo Novidades do jogo.
- Versão em inglês para comparação.
- Busca, temas claro/escuro, modos PvE/PvP/evolução, painéis Daevanion e controles locais de progresso.
- Tradução inicial com Argos Translate en-pb 1.9 executado localmente. Interface e partes principais do Clérigo revisadas; textos restantes precisam de revisão editorial.
- Nomes de habilidades, itens e chefes preservados em inglês quando usados como dados do cliente Global. Não é uma tradução oficial do jogo.

## Pastas e atualização

O gerador atual é `tools/build_snapshot.py`, acionado por `tools/build.py`. `source-snapshot/en/` contém as páginas e os dados públicos da fonte; `source-snapshot/assets/` contém seus recursos atualizados; `source-snapshot/provenance.json` registra a origem e as datas. As traduções ficam em `translations/memory.json`; as revisões manuais têm prioridade em `translations/reviewed.json`. `dist/` é o site pronto. A estrutura `data/` e `src/` da edição inicial fica preservada como referência e como base dos recursos compartilhados.

Para gerar novamente: instale Python e as dependências de `requirements.txt`, então execute `python tools/build.py` na pasta do projeto. O build é local e determinístico: não depende de serviço de tradução nem de acesso à fonte. Para visualizar: `python -m http.server 8313 --directory dist`, depois abra http://localhost:8313/ . O servidor local deve ser iniciado apenas durante o uso.

As atualizações do projeto original não são importadas automaticamente. Compare alterações e revise as traduções antes de atualizar. Informações, horários e recomendações do jogo refletem as fontes do projeto original; a tradução não constitui nova verificação no jogo.

Esta captura inclui as builds e macros revisadas, os modos PvP de Assassino e Chanter, a progressão de Aragon após o nível 45, pets/Genus Insight, títulos, o controle semanal com roster e assinatura por conta, os relógios de Rift/Shugo e a distribuição do orçamento total de cristais Daevanion. As notas do jogo são uma captura datada e não recebem atualizações automáticas.

## Créditos

Projeto original: Couga54 / AION 2 Guides. Referências e criadores estão na página de fontes. AION 2 e os recursos do jogo pertencem à NCSOFT; dados de habilidades, itens e painéis vêm do Questlog. A identidade, as análises de acesso e o formulário de mensagens do proprietário original foram desativados nesta edição independente.

Publicação inicial privada pelo Sites. A pasta `.openai/` contém a identidade desta hospedagem; não a reutilize para registrar outro projeto.
