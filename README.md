# Missão da Noite

App web (PWA) com mini-jogos de 10 minutos para a rotina da noite: atenção, ordem das letras e números, memória, controle de impulso e respiração para desacelerar antes de dormir.

- Sem servidor, sem conta, sem anúncios, sem dependências.
- Funciona offline depois da primeira abertura.
- Todos os dados ficam **só no aparelho** (localStorage). Nada é enviado.

## Publicar no GitHub Pages (grátis)

1. Crie um repositório (ex.: `missao-da-noite`) e envie estes arquivos na raiz.
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Aguarde 1–2 min. O endereço será `https://SEU-USUARIO.github.io/missao-da-noite/`.
4. No celular/tablet, abra o endereço e use **Adicionar à tela inicial** (Chrome: menu ⋮; Safari: Compartilhar).

> Repositório público = o código e o endereço ficam públicos. Os dados do seu filho não, pois nunca saem do aparelho. Se preferir, use repositório privado (Pages privado exige plano pago).

## Como funciona

**Missões do dia:** 3 por noite (configurável de 1 a 5), uma de cada tipo, rotacionando por dia.

| Missão | Treina |
|---|---|
| Caça-letras | atenção visual, discriminação de letras parecidas |
| Meu nome | ordem das letras (nome e palavras curtas) |
| Números em fila | ordem numérica, contagem regressiva |
| Conta as bolas | contagem com correspondência 1 a 1 |
| Seu mestre mandou | controle inibitório (esperar, não tocar) |
| Memória | memória de trabalho (pares) |
| Luzes mágicas | memória de sequência |
| Respirar e dormir | desacelerar (1 min, sem pontuação) |

**Níveis (1 a 3):** sobem após 2 sessões com ≥ 85% de acerto e descem após 2 sessões com < 50%. Dá para ajustar à mão na área dos pais.

**Limite diário:** ao completar as missões do dia, só resta a respiração. A criança acaba pedindo "mais" no dia seguinte, o que reforça o hábito.

**Estrelas da semana:** 1 por dia com missão feita. Com 5 estrelas aparece "Escolha a história da noite!".

**Voz:** o app lê as instruções em português (voz do aparelho), pois uma criança de 4 anos ainda não lê.

## Área dos pais

Segure o ⚙️ por 1,5 s. Lá você:

- troca o nome da criança, do guia (você mesmo digita; o app não usa personagens de terceiros), do clube e o ícone do guia;
- define missões por dia, liga/desliga voz e sons;
- registra a noite (horário em que dormiu, minutos de tela, atenção e humor de 1 a 5);
- vê o resumo dos últimos 7 dias;
- baixa **missoes.csv** e **dias.csv** (separador `;`, acentos corretos para Excel/Google Planilhas em português).

## Limitações (leia)

1. **O app não controla o tempo de tela de outros apps.** Para reduzir Roblox/YouTube, use o controle parental do sistema (Google Family Link no Android, Tempo de Uso no iPhone/iPad).
2. **Dados só no aparelho.** Limpar os dados do navegador apaga o histórico. Baixe os CSVs toda semana. Cada aparelho tem seu próprio histórico.
3. **Atualizações** aparecem na segunda abertura do app depois de publicar (cache offline).
4. **A voz depende do aparelho.** Se não houver voz em português instalada, o app funciona sem som falado.
5. **Isto não é diagnóstico nem terapia.** Os números de acerto servem para acompanhar a evolução, não para avaliar TDAH ou atraso. Dúvidas sobre atenção e sono: pediatra.

## Para evoluir

- Novas missões: adicione um bloco `MISSIONS.nome = { id, emoji, title, run(c) }` em `app.js` e inclua o id em `GROUPS`.
- Trocar o cache: altere `CACHE = 'mdn-v1'` em `sw.js` quando publicar uma versão grande.
- Teste rápido local: `python3 -m http.server` na pasta e abra `http://localhost:8000`.
