// SÓ VAI FUNCIONAR MESMO A PARTIR DO MÊS DE MARÇO PORQUE VAI TER DADOS PRA ISSO
async function saudeMensal() {
    const db = firebase.firestore();

    const snapshot = await db.collection('vendas').get()

    const idLoja = localStorage.getItem('selecaoLoja')

    let totalEntradas = 0
    let totalSaidas = 586.18 //NÚMERO PROVISÓRIO, TROCAR PELA SOMA DAS COMPRAS E POSSIVEIS SAÍDAS

    // CALCULANDO O TOTAL DE ENTRADAS
    snapshot.forEach(venda => {
        const dados = venda.data();
        if (dados.idLoja != idLoja) return
        totalEntradas += dados.totalVenda
    })

    const entradas = document.getElementById('entradas')
    const pEntradas = document.createElement('p')
    pEntradas.textContent = "+ " + "R$ " + totalEntradas.toFixed(2).replace('.',',')
    entradas.appendChild(pEntradas)

    const saidas = document.getElementById('saidas')
    const pSaidas = document.createElement('p')
    pSaidas.textContent = "+ " + "R$ " + totalSaidas.toFixed(2).replace('.',',')
    saidas.appendChild(pSaidas)

    const balanco = document.getElementById('balanco')
    const pBalanco = document.createElement('p')
    const somaBalanco = totalEntradas - totalSaidas
    if (somaBalanco > 0){
        pBalanco.textContent ='+ ' + "R$ " + somaBalanco.toFixed(2).replace('.',',')
        balanco.style.color = 'green'
        balanco.appendChild(pBalanco)
    } else {
        pBalanco.textContent ="R$ " + somaBalanco.toFixed(2).replace('.',',')
        balanco.style.color = 'red'
        balanco.appendChild(pBalanco)
    }
    
    
}

function descobrirSemana() {
    const hoje = new Date();

    // 0 = Domingo, 1 = Segunda ... 6 = Sábado
    const diaSemana = hoje.getDay();

    // Pega o domingo da semana atual
    const domingo = new Date(hoje);
    domingo.setDate(hoje.getDate() - diaSemana);

    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const semana = [];

    for (let i = 0; i < 7; i++) {
        const dia = new Date(domingo);
        dia.setDate(domingo.getDate() + i);

        // Formata a data como DD/MM/YYYY
        const diaFormatado = dia.getDate().toString().padStart(2, '0');
        const mesFormatado = (dia.getMonth() + 1).toString().padStart(2, '0'); // meses começam do 0
        const ano = dia.getFullYear();
        const dataStr = `${diaFormatado}/${mesFormatado}/${ano}`;

        semana.push({
            diaNome: nomesDias[i],
            data: dataStr
        });
    }

    return semana;
}

async function resumoSemanal() {   
    //CRIA O GRÁFICO
    var options = {
        chart: {
            type: 'line',
            height: 300,
            toolbar: { show: false },
            color: 'yellow'
        },
        series: [{ name: 'Vendas', data: [0,0,0,0,0,0,0]}],        
        xaxis: { categories: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] },
        tooltip: {
            theme: 'dark',           // muda todo o tooltip para cores escuras
            marker: { show: true },
            style: { fontSize: '14px', fontFamily: 'Arial' },
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                // retorna só o valor, sem "series-1"
                return `<div style="background-color: rgba(0,0,0,0.8); color: #fff; padding: 5px 10px; border-radius: 5px;">
                            ${w.globals.labels[dataPointIndex]}: ${series[seriesIndex][dataPointIndex]}
                        </div>`;
            }
        }
    };
    var chart = new ApexCharts(document.querySelector("#grafico"), options);
    chart.render();

    // PUXAR AS VENDAS POR DIA DA SEMANA
    let vendasDom = 0
    let vendasSeg = 0
    let vendasTer = 0
    let vendasQua = 0
    let vendasQui = 0
    let vendasSex = 0
    let vendasSab = 0

    // PUXANDO AS DATAS DAS SEMANAS
    const semana = descobrirSemana()

    // CRIANDO UM ARRAY PRA ARMAZENAS OS VALORES DE CADA DIA
    const totais = Array(7).fill(0);

    // ENTRANDO NO BD PRA PUXAR VENDA A VENDA DE CADA DIA E COLOCAR NO GRÁFICO
    const db = firebase.firestore();

    const snapshot = await db.collection('vendas').get()

    const idLoja = localStorage.getItem('selecaoLoja')

    snapshot.forEach(doc => {
        const dados = doc.data();
        const dataVenda = dados.data; 

        if (dados.idLoja == idLoja) {
            if (dataVenda == semana[0].data) {
            vendasDom += 1 
            } if (dataVenda == semana[1].data) {
                vendasSeg += 1
            } if (dataVenda == semana[2].data) {
                vendasTer += 1 
            } if (dataVenda == semana[3].data) {
                vendasQua += 1 
            } if (dataVenda == semana[4].data) {
                vendasQui += 1 
            } if (dataVenda == semana[5].data) {
                vendasSex += 1 
            } if (dataVenda == semana[6].data) {
                vendasSab += 1 
            }
        }

    });

    // ATUALIZANDO O GRÁFICO
    chart.updateSeries([{ data: [vendasDom,vendasSeg,vendasTer,vendasQua,vendasQui,vendasSex,vendasSab], color: 'yellow' }])
}

function parseData(dataStr) {
    const partes = dataStr.split('/')   // ["DD","MM","AAAA"]
    const dia = parseInt(partes[0], 10)
    const mes = parseInt(partes[1], 10) - 1 // JS meses começam em 0
    const ano = parseInt(partes[2], 10)
    return new Date(ano, mes, dia)
}

function parseDataInput(inputStr) {
    const [ano, mes, dia] = inputStr.split('-')
    return new Date(ano, mes-1, dia)
}

async function faturamentoPorDia() { //FUNÇÃO QUE EU ESCOLHO A DATA E ELE ME RETORNA O FATURAMENTO E LUCRO
    // PUXA TODOS OS INPUTS E O QUE PRECISAR MAIS
    const dataFinal = document.getElementById('dataFinal')
    const dataInicial = document.getElementById('dataInicial')
    const faturamento = document.getElementById('faturamento')
    const despesas = document.getElementById('despesas')
    const lucro = document.getElementById('lucro')
    const idLoja = localStorage.getItem('selecaoLoja')
    const db = firebase.firestore()
    const snapshot = await db.collection('vendas').get()

    async function calcularFaturamento() {
        // ZERA TODAS AS LETS PRA PODER INICIAR O CALCULO
        let faturamentoTotal = 0
        let custosTotais = 0
        let lucroTotal = 0

        // PUXA OS INPUTS DAS DATAS
        const inicio = parseDataInput(dataInicial.value)
        const fim = parseDataInput(dataFinal.value)

        // ABRE O LOADING PRA PODER MOSTRAR QUE TÁ CARREGANDO NA TELA
        Loading()

        // ENTRA NUM FOR PRA PODER VER VENDA A VENDA
        for (const venda of snapshot.docs) {
            const dados = venda.data()

            // SE O ID NA VENDA NÃO FOR O MESMO DA LOJA SELECIONADA ELE NÃO CONTINUA
            if (dados.idLoja !== idLoja) continue

            // PUXA A DATA DA VENDA E CONVERTE PARA UMA DATA QUE O SISTEMA LÊ MELHOR
            const vendaData = parseData(dados.data)

            // SE A DATA DA VENDA FOR MAIOR OU IGUAL A DATA INICIO E MENOS OU IGUAL A DATA FIM ELE ENTRA NO IF
            if (vendaData >= inicio && vendaData <= fim) {
                faturamentoTotal += Number(dados.totalVenda)
                
                // ELE VAI FAZER O CALCULO DO CUSTO EM OUTRA FUNÇÃO E O SISTEMA ESPERA ELE TERMINAR TUDO
                const lucro = await calcularLucro(dados.produtos, dados.meiosPagamento)
                lucroTotal += lucro
            }
        }

        // PARA O LOADING
        Loading()

        //ELE FAZ UMA SOMA SIMPLES, TIRA O LUCRO DO FATURAMENTO E O QUE RESTAR É CUSTO
        custosTotais = faturamentoTotal - lucroTotal

        // ESCREVE TUDO NO SISTEMA PRA FICAR VISIVEL
        faturamento.textContent = 'R$ ' + faturamentoTotal.toFixed(2)
        const lucroPercent = faturamentoTotal > 0 ? (lucroTotal / faturamentoTotal) * 100 : 0;
        lucro.textContent = 'R$ ' + lucroTotal.toFixed(2) + ' ou ' + lucroPercent.toFixed(2) + '%'
        despesas.textContent = 'R$ ' + custosTotais.toFixed(2)
    }

    // Atualiza sempre que mudar a data inicial ou final
    dataInicial.addEventListener('change', calcularFaturamento)
    dataFinal.addEventListener('change', calcularFaturamento)

    // Calcula inicialmente se já houver valores preenchidos
    if (dataInicial.value && dataFinal.value) {
        calcularFaturamento()
    }
}

//Função de calculo de lucro
async function calcularLucro(produtos, pagamento) {
    const db = firebase.firestore()
    const idLoja = localStorage.getItem('selecaoLoja')
    const snapshot = await db.collection('produtos').where('idLoja', '==', idLoja).get()

    if (snapshot.empty) return 0

    let lucroTotal = 0
    let taxaPaga = 0
    
    // Soma todas as taxas
    pagamento.forEach(meio => {
        taxaPaga += Number(meio.taxa || 0)

        console.log('--- PAGAMENTO ---')
        console.log(meio)
        console.log('taxa acumulada:', taxaPaga)
    })

    // Cria um mapa de produtos pra busca rápida
    const mapaProdutos = {}
    snapshot.forEach(doc => {
        const dados = doc.data()
        mapaProdutos[dados.nome] = dados
    })

    // Calcula lucro dos produtos
    produtos.forEach(produto => {
        const quantidade = Number(produto.quantidade || 1)

        // tenta pegar do próprio produto (mais confiável)
        const vendaTotal = Number(produto.valorTotal || 0)

        let custoUnitario = 0

        if (produto.valorDeCusto != null) {
            custoUnitario = Number(produto.valorDeCusto)
        } else {
            // fallback pro banco (caso não tenha no produto)
            const dadosProduto = mapaProdutos[produto.nome]

            if (!dadosProduto) {
                console.warn('Produto sem custo e não encontrado:', produto)
                return
            }

            custoUnitario = Number(dadosProduto.valorCompra)
        }

        const custoTotal = custoUnitario * quantidade
        const lucro = vendaTotal - custoTotal

        lucroTotal += lucro
    })

    // Desconta taxa UMA vez
    lucroTotal -= taxaPaga

    return Number(lucroTotal.toFixed(2))
}

function Loading() {
    const loading = document.getElementById('loading')
    loading.classList.toggle('ativo')
}

faturamentoPorDia()
resumoSemanal()
saudeMensal()