//Funcão para abrir o Swal de criação de uma nova venda
async function abrirSwalCompra() {
  let produtos = [];

  const html = document.getElementById("template-compra").innerHTML;

  await Swal.fire({
    title: "Cadastro de Compra",
    width: "1400px",
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    heightAuto: false,
    customClass: {
      popup: "swal-venda-popup"
    },
    html: html,
    didOpen: () => {
      addDataListDadosProdutos()
    },

    preConfirm: () => {
      
    }
  }).then((result) => {
    if (!result.isConfirmed) return;

    try {
      registrarCompra()
    } catch (error) {
      console.log(error) 
      return alert('Erro em salvar compra, tente novamente.')
    }

    Swal.fire({
      title: "Salvo!",
      icon: "success",
      heightAuto: false,
      customClass: {
        popup: "swal-venda-popup"
      }
    });
  });
}

// Let pra armazenar as infomações da compra atual
let compraAtual = {
  produtos: [],
  pagamento: [],
  fornecedor: [],
  totalCompra: 0,
  idLoja: '',
  criadoEm: '',
  idCompra: '',
  status: ''
}

function addListaPedido() {
    const produto = document.getElementById('nomeProdutoPedido')
    const quantidade = document.getElementById('quantidadePedido')
    const compra = document.getElementById('valorCompraPedido')
    const venda = document.getElementById('valorVendaPedido')
    const atacado = document.getElementById('valorAtacadoPedido')
    const totalCompra = document.getElementById('totalCompra')

    const nomeProduto = produto.value.trim()
    const quantidadeNumero = Number(quantidade.value) || 0
    const compraNumero = Number(String(compra.value).replace(',', '.')) || 0
    const vendaNumero = Number(String(venda.value).replace(',', '.')) || 0
    const atacadoNumero = Number(String(atacado.value).replace(',', '.')) || 0

    const totalDoItem = compraNumero * quantidadeNumero

    if (
        !nomeProduto ||
        quantidadeNumero <= 0 ||
        compraNumero <= 0 ||
        vendaNumero <= 0||
        totalDoItem <= 0
    ) {
        console.warn('Produto inválido, não adicionado à compra')
        return
    }

    const idItem = Date.now().toString()
    const tbody = document.getElementById('swal-venda-tabela-compra')
    const tr = document.createElement('tr')
    tr.dataset.id = idItem

    // Produto
    const tdProduto = document.createElement('td')
    tdProduto.textContent = nomeProduto
    tr.appendChild(tdProduto)

    // Quantidade
    const tdQuantidade = document.createElement('td')
    tdQuantidade.textContent = quantidadeNumero
    tr.appendChild(tdQuantidade)

    // Valor compra
    const tdValor = document.createElement('td')
    tdValor.textContent = 'R$ ' + compraNumero.toFixed(2).replace('.', ',')
    tr.appendChild(tdValor)

    // Valor total
    const tdTotal = document.createElement('td')
    tdTotal.textContent = 'R$ ' + totalDoItem.toFixed(2).replace('.', ',')
    tr.appendChild(tdTotal)

    // Botão de exclusão
    const tdExcluir = document.createElement('td')
    const btnExcluir = document.createElement('button')
    btnExcluir.textContent = '🗑'
    tdExcluir.appendChild(btnExcluir)
    tr.appendChild(tdExcluir)

    tbody.appendChild(tr)

    if (!Array.isArray(compraAtual.produtos)) {
        compraAtual.produtos = []
    }

    compraAtual.produtos.push({
        nome: nomeProduto,
        quantidade: quantidadeNumero,
        valorCompra: compraNumero,
        valorVenda: vendaNumero,
        valorAtacado: atacadoNumero,
        valorTotalItem: totalDoItem,
        id: idItem
    })
    
    totalCompra.value = atualizarValorTotal(compraAtual)

    produto.value = ''
    quantidade.value = ''
    compra.value = ''
    venda.value = ''
    atacado.value = ''

    produto.focus()

    btnExcluir.addEventListener('click', () => {
        const linha = btnExcluir.closest('tr')
        const id = linha.dataset.id
        compraAtual.produtos = compraAtual.produtos.filter(produto => produto.id !== id)
        linha.remove()
        totalCompra.value = atualizarValorTotal(compraAtual)
    })

    const descontoInput = document.getElementById('valorDesconto')
    const freteInput = document.getElementById('valorFrete')

    descontoInput.addEventListener('input', () => {
      totalCompra.value = atualizarValorTotal(compraAtual)
    })

    freteInput.addEventListener('input', () => {
      totalCompra.value = atualizarValorTotal(compraAtual)
    })
}

//Função de calculo de valor total da compra com descontos ou frete
function atualizarValorTotal(compraAtual) {
  let totalDaCompra = 0

  compraAtual.produtos.forEach(produto => {
    totalDaCompra += Number(produto.valorTotalItem)
  })

  const descontoInput = document.getElementById('valorDesconto')
  const freteInput = document.getElementById('valorFrete')

  const desconto = Number(descontoInput.value.replace(',', '.')) || 0
  const frete = Number(freteInput.value.replace(',', '.')) || 0

  const conta = totalDaCompra + frete - desconto

  return 'R$' + conta.toFixed(2).replace('.', ',')
}

//Função para cadastro do fornecedor a partir do clique do botão
async function cadastrarFornecedor() {
    alert('Função em desenvolvimento')
}

async function addDataListDadosProdutos() {
  const db = firebase.firestore();
  const idLoja = localStorage.getItem('selecaoLoja')
  const produtos = await db.collection('produtos').orderBy('nome').get()

  produtos.forEach(doc => {
    const dados = doc.data();
    
    if (dados.idLoja != idLoja) return
    
    const listaProdutos = document.getElementById('listaProdutosPedido')

    const nomeProduto = document.createElement('option')
    nomeProduto.value = dados.nome
    nomeProduto.textContent = dados.nome
    listaProdutos.appendChild(nomeProduto)
  })

  const inputProduto = document.getElementById('nomeProdutoPedido')

  inputProduto.addEventListener('change', () => {
    produtos.forEach(doc => {
      const dados = doc.data();

      if (dados.nome != inputProduto.value) return

      const valorCompra = document.getElementById('valorCompraPedido')
      const valorVenda = document.getElementById('valorVendaPedido')
      const valorAtacadoPedido = document.getElementById('valorAtacadoPedido')
      
      valorCompra.value = dados.valorCompra
      valorVenda.value = dados.valorVenda
      valorAtacadoPedido.value = dados.valorAtacado

    })
  })
}

async function registrarCompra() {
  const db = firebase.firestore();
  const idLoja = localStorage.getItem('selecaoLoja')

  const nomeFornecedor = document.getElementById('nomeFornecedor')
  const cnpjFornecedor = document.getElementById('cnpjFornecedor');

  compraAtual.fornecedor.push({
    nome: nomeFornecedor.value,
    cnpj: cnpjFornecedor ? cnpjFornecedor.value : "Sem CNPJ",
  })

  const valorPago = document.getElementById('valorPago')
  const vencimentoCompra = document.getElementById('vencimentoCompra')
  const valorDesconto = document.getElementById('valorDesconto')
  const valorFrete = document.getElementById('valorFrete')
  const totalCompra = document.getElementById('totalCompra')

  compraAtual.pagamento.push({
    valorPago: valorPago.value,
    vencimentoCompra: vencimentoCompra.value,
    valorDesconto: valorDesconto.value,
    valorFrete: valorFrete.value,
  })

  const idCompra = crypto?.randomUUID?.() ?? 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);

  compraAtual.totalCompra = totalCompra.value;
  compraAtual.idLoja = idLoja;
  compraAtual.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
  compraAtual.idCompra = idCompra;
  compraAtual.status = 'PENDENTE';

  try {
    await Promise.all(
      compraAtual.produtos.map(produto =>
        atualizarEstoqueCompras(
          produto.nome,
          produto.quantidade,
          produto.valorCompra,
          produto.valorVenda,
          produto.valorAtacado
        )
      )
    )
  } catch (error) {
    console.log(error)
    return
  }

  await db.collection('compras').add(compraAtual);

  console.log(compraAtual)

  compraAtual = {
    produtos: [],
    pagamento: [],
    fornecedor: [],
    totalCompra: 0,
    idLoja: '',
    criadoEm: '',
    idCompra: '',
    status: ''
  };
}

async function atualizarEstoqueCompras(nomeProduto, quantidadeProduto, valorCompra, valorVenda, valorAtacado) {
  const db = firebase.firestore()
  const idLoja = localStorage.getItem('selecaoLoja')

  const produtos = await db.collection('produtos')
    .where('idLoja', '==', idLoja)
    .where('nome', '==', nomeProduto)
    .get()

  for (const item of produtos.docs) {
    const produto = item.data()

    const estoqueAtual = Number(produto.estoque)
    const quantidade = Number(quantidadeProduto)
    const somaEstoque = estoqueAtual + quantidade

    const dataFormatada = new Date().toLocaleDateString('pt-BR')

    const markup = (valorVenda - valorCompra) / valorVenda

    const novoEstoque = {
      ultimaCompra: dataFormatada,
      margemLucro: markup,
      estoque: somaEstoque,
      valorCompra: valorCompra,
      valorVenda: valorVenda,
      valorAtacado: valorAtacado
    }

    await db.collection('produtos').doc(item.id).update(novoEstoque)

    console.log('Atualizado:', produto.nome, somaEstoque)
    console.log(novoEstoque)
  }
}

async function gerarTabelaCompras() {
  const db = firebase.firestore();
  const idLoja = localStorage.getItem('selecaoLoja')
  const compras = await db.collection('compras').orderBy('criadoEm', "desc").get() 

  compras.forEach(compra => {
    const dados = compra.data();
    
    if (dados.idLoja != idLoja) return
    
    const tabela = document.getElementById('ultimasCompras')

    const tr = document.createElement('tr')

    const data = document.createElement('td');
    if (dados.criadoEm && typeof dados.criadoEm.toDate === 'function') {
      data.textContent = dados.criadoEm.toDate().toLocaleDateString('pt-BR');
    } else if (typeof dados.criadoEm === 'string') {
      data.textContent = dados.criadoEm;
    } else {
      data.textContent = '';
    }

    tr.appendChild(data);

    const fornecedor = document.createElement('td')
    fornecedor.textContent = dados.fornecedor[0].nome.toUpperCase();
    tr.appendChild(fornecedor)

    const valorCompra = document.createElement('td')
    valorCompra.textContent = dados.totalCompra
    tr.appendChild(valorCompra)

    const vencimento = document.createElement('td');

    const valor = dados.pagamento?.[0]?.vencimentoCompra;

    if (valor) {
      const data = new Date(valor);
      vencimento.textContent = isNaN(data)
        ? valor
        : data.toLocaleDateString('pt-BR');
    } else {
      vencimento.textContent = '';
    }

    tr.appendChild(vencimento);

    const status = document.createElement('td')
    status.textContent = dados.status
    tr.appendChild(status)

    tabela.appendChild(tr)
  })
}

async function mostrarCompras() {
  const db = firebase.firestore();
  const idLoja = localStorage.getItem('selecaoLoja')
  const compras = await db.collection('produtos').orderBy('nome').get()

  compras.forEach(compra => {
    const dados = compra.data();
    console.log(dados)


  })
  
}

gerarTabelaCompras()