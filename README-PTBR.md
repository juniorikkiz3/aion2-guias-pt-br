# AION 2 — Guias em português do Brasil

Versão independente baseada em https://github.com/Couga54/aion2-guides.

## Conteúdo

- 19 páginas em PT-BR: início, oito classes e dez páginas de guias/ferramentas.
- Versão em inglês para comparação.
- Busca, temas claro/escuro, modos PvE/PvP/evolução, painéis Daevanion e controles locais de progresso.
- Tradução inicial com Argos Translate en-pb 1.9 executado localmente. Interface e partes principais do Clérigo revisadas; textos restantes precisam de revisão editorial.
- Nomes de habilidades, itens e chefes preservados em inglês quando usados como dados do cliente Global. Não é uma tradução oficial do jogo.

## Pastas e atualização

`data/i18n.json` contém a interface. As chaves `pt-BR` nos arquivos de `data/` contêm os textos traduzidos. `src/content/<classe>/pt-BR.html` contém os guias. `src/templates/` e `src/assets/` contêm o visual e as ferramentas. `dist/` é o site pronto.

Para gerar novamente: instale Python e Jinja2 e execute `python tools/build.py` na pasta do projeto. Para visualizar: `python -m http.server 8313 --directory dist`, depois abra http://localhost:8313/ . O servidor local deve ser iniciado apenas durante o uso.

As atualizações do projeto original não são importadas automaticamente. Compare alterações e revise as traduções antes de atualizar. Informações, horários e recomendações do jogo refletem as fontes do projeto original; a tradução não constitui nova verificação no jogo.

## Créditos

Projeto original: Couga54 / AION 2 Guides. Referências e criadores estão na página de fontes. AION 2 e os recursos do jogo pertencem à NCSOFT; dados de habilidades, itens e painéis vêm do Questlog. A identidade, as análises de acesso e o formulário de mensagens do proprietário original foram desativados nesta edição independente.

Publicação inicial privada pelo Sites. A pasta `.openai/` contém a identidade desta hospedagem; não a reutilize para registrar outro projeto.
