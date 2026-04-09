# MESTRE MARO
---

Funções do sistema:
- PDV:
    - Adicionar produtos na venda
    - Remover produtos
    - Alterar quantidade e valor
    - Calcular total automático
    - Calcular total à vista
    - Aplicar desconto (R$ e %)
    - Aplicar acréscimo (R$ e %)
    - Calcular troco e valor restante
    - Suporte a múltiplos pagamentos
    - Finalizar venda
    - Limpar venda (reset PDV)
    - Autocomplete de produtos

- PAGAMENTOS:
    - Entrada de múltiplos meios de pagamento
    - Cálculo automático de taxas por tipo
    - Validação do pagamento antes de finalizar
    - Cálculo de troco/restante automático

- PIX + TELEGRAM:
    - Gerar código PIX (copia e cola)
    - Gerar QR Code PIX
    - Enviar mensagem no Telegram
    - Enviar imagem (QR Code) no Telegram
    - Enviar valor e descrição do pagamento
    - Enviar notificações automáticas (ex: metas)

- ESTOQUE:
    - Atualizar estoque automaticamente após venda
    - Listar produtos
    - Exibir estoque atual
    - Aviso de estoque baixo
    - Controle de estoque mínimo

- PRODUTOS:
    - Cadastrar produto
    - Editar produto
    - Excluir produto (com senha)
    - Definir preço de compra
    - Definir preço de venda
    - Calcular margem de lucro automática
    - Definir preço de atacado
    - Organizar produtos por grupo

- CLIENTES:
    - Cadastrar cliente
    - Buscar cliente por nome
    - Autocomplete de clientes
    - Armazenar dados (telefone, Instagram, nascimento)

- CASHBACK:
    - Gerar cashback automático (2%)
    - Consultar saldo disponível
    - Aplicar cashback na compra
    - Bloquear uso acima do permitido
    - Expiração automática do cashback
    - Histórico de cashback utilizado

- VENDAS (GESTÃO):
    - Registrar venda no banco (Firebase)
    - Armazenar produtos vendidos
    - Armazenar meios de pagamento
    - Armazenar cliente
    - Armazenar total, data e hora
    - Gerar ID único de venda
    - Visualizar últimas vendas
    - Visualizar detalhes da venda
    - Cancelar venda (com senha)
    - Reimprimir venda

- IMPRESSÃO:
    - Imprimir pedido estilo cupom (80mm)
    - Impressão automática
    - Suporte a pedido balcão
    - Suporte a pedido entrega
    - Inserir endereço de entrega
    - Inserir observações do pedido
    - Calcular taxa de entrega

- DASHBOARD / RELATÓRIOS:
    - Vendas do dia
    - Vendas do mês
    - Quantidade de vendas
    - Ticket médio
    - Progresso da meta (%)
    - Gráfico semanal de vendas
    - Faturamento por período
    - Cálculo de lucro
    - Cálculo de despesas
    - Balanço financeiro (lucro/prejuízo)

- METAS:
    - Definir meta diária
    - Definir meta mensal
    - Atualizar metas
    - Acompanhar progresso em %
    - Notificar mudanças via Telegram

- COMPRAS / FORNECEDORES:
    - Registrar compras
    - Adicionar produtos na compra
    - Calcular total da compra
    - Aplicar desconto na compra
    - Aplicar frete
    - Associar fornecedor
    - Definir vencimento
    - Definir status da compra (pendente)
    - Listar compras realizadas

- MULTI-LOJA:
    - Selecionar loja no login
    - Filtrar dados por loja
    - Separação de dados por unidade
    - Controle de acesso por cargo

- SEGURANÇA:
    - Login com Firebase
    - Logout
    - Proteção por senha para exclusões
    - Proteção para cancelamento de venda

---

## Versões:##

## V0.4.0:
- Reformulado completamente o script de resumo financeiro, agora ele faz o calculo certo de valor vendido, valor de custo, taxas e no final da o lucro liquido total e porcentagem de lucro sobre o faturamento;

    - Usamos a função `calcularLucro(produtos, pagamento)` para fazer o trabalho pesado, resultando no calculo que precisamos

## V0.4.1:
- Colocado novos arquivos JS para separação de funções por tela (Financeiro, PDV, entre outros) para melhor organização em geral e adição de novas funções no sistema
- Adicionado página de 'Compras'
- Adicionado tabela de compras recentes
- Adicionado botão de adição de compra
- Adicionado modal de cadastro de compra com campos necessários

## V0.4.2:
- Adicionado botão de "imprimir pedido" no modal de visualização de venda, justamente pra caso precise imprimir a notinha apos passar a venda, tem botão pra isso
- Adicionado toda a logica de adição de produtos no modal, agora além de mostrar o nome para escolha, assim que selecionado ele retorna os valores de compra, venda e de atacado registrados anteriormente no banco de dados (Leiasse na ultima compra)
- Adicionado função para completar a tabela de compras ordenando pela mais recente pra mais antiga
- Adicionado função de criação de nova venda, com produtos, valores, valores pagos e mais

## V0.4.2.1:
- Finalmente decidimos o nome oficial do projeto, em homenagem ao meu avó coloquei o apelido dele que é "MESTRE MARO" junto com o vetor do rosto dele como logo.
- Também mudamos os nomes de cabeçalho da página e adicionamos o logo do projeto na aba do Header

## V0.4.3:
- Adicionado botão de edicão de produto
- Reestilizado os modais e edicão e adicão de produto
- Adicionado a função de conferencia de estoque, vai passando produto a produto e voce digita a quantidade em loja, no final mostra uma tabela de quanto tinha e quando voce colocou que tem, no final salva no banco de dados
- Arrumado um bug na hora de conferir o estoque de itens sem codigo de barras
- Arrumado um bug na hora de abrir um produto sem codigo de barras ele puxava a tela de qual ele queria
- Finalizado a função de edição de produtos, agora você edita e ele salva a edição completamente

## V0.4.4
- Adicionado a função de registro de compras, onde ao colocar todos os itens e seus respctivos valores ele atualiza juntamente ao cadastro, colocando estoque e atualizando preços 
- Adicionado dentro do cadastro e edição de produtos um botão para não rastrear estoque, sendo assim caso voce tenha um produto onde não tem necessidade de rastrear o estoque basta deixar selecionado que ficara como indeterminado e não ficara aparecendo como item com estoque baixo na tela de visão geral
- Adicionado uma pagina de apresentação do projeto intitulada `index.html` e a que era essa virou `login.html`
- Feito alteraçoes na pagina inicial
- Adicionado arquivo ´.htaccess´ para melhor visualização dos links

## V0.4.5
- Adicionado pagina de ADM pra organizar as funções administrativas do sistema em um canto só
- Organizado algumas coisas no geral