async function saudeMensal() {
    const idLoja = localStorage.getItem('selecaoLoja')
    const db = firebase.firestore()

    // Primeiro e último dia do mês atual
    const hoje = new Date()
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    primeiroDiaMes.setHours(0,0,0,0) // 00:00:00
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    ultimoDiaMes.setHours(23,59,59,999) // 23:59:59

    const timestampInicio = firebase.firestore.Timestamp.fromDate(primeiroDiaMes)
    const timestampFim = firebase.firestore.Timestamp.fromDate(ultimoDiaMes)

    // Pré-carrega todos os produtos da loja
    const snapshotProdutos = await db.collection('produtos')
        .where('idLoja', '==', idLoja)
        .get()

    const mapaProdutos = {}
    snapshotProdutos.forEach(doc => {
        const dados = doc.data()
        mapaProdutos[dados.nome] = dados
    })

    // Busca todas as vendas do mês atual com limite superior
    const snapshot = await db.collection('vendas')
        .where('idLoja', '==', idLoja)
        .where('criadoEm', '>=', timestampInicio)
        .where('criadoEm', '<=', timestampFim) // ajuste: limite superior do mês
        .orderBy('criadoEm', 'asc')
        .get()

    try {
        // Calcula lucro de cada venda em paralelo
        const promessas = snapshot.docs.map(dados => {
            const venda = dados.data()
            const totalVenda = Number(venda.totalVenda || 0)
            return calcularLucro(venda.produtos, venda.meiosPagamento)
                .then(lucroVenda => ({
                    totalVenda,
                    lucro: Number(lucroVenda || 0)
                }))
        })

        const resultados = await Promise.all(promessas)

        

        // Soma total de entradas, lucro e custos
        const totalEntradas = resultados.reduce((acc, r) => acc + r.totalVenda, 0)
        const lucroTotal = resultados.reduce((acc, r) => acc + r.lucro, 0)
        const totalSaidas = totalEntradas - lucroTotal
        const somaBalanco = totalEntradas - totalSaidas

        // Atualiza DOM mantendo títulos
        const entradasSpace = document.getElementById('entradas')
        const pEntradas = document.createElement('p')
        pEntradas.textContent = 'R$ ' + totalEntradas.toFixed(2).replace('.',',')
        entradasSpace.appendChild(pEntradas)

        const saidasSpace = document.getElementById('saidas')
        const pSaidas = document.createElement('p')
        pSaidas.textContent = 'R$ ' + totalSaidas.toFixed(2).replace('.',',')
        saidasSpace.appendChild(pSaidas)

        const balancoSpace = document.getElementById('balanco')
        const pBalanco = document.createElement('p')
        if (somaBalanco < 0) {
            pBalanco.textContent = '- R$ ' + somaBalanco.toFixed(2).replace('.',',')
        } else {
            pBalanco.textContent = 'R$ ' + somaBalanco.toFixed(2).replace('.',',')
        }
        pBalanco.style.color = somaBalanco >= 0 ? 'green' : 'red'
        balancoSpace.appendChild(pBalanco)

    } finally {
        
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

async function faturamentoPorDia() { // FUNÇÃO QUE RETORNA FATURAMENTO E LUCRO A PARTIR DA DATA
    const dataFinal = document.getElementById('dataFinal')
    const dataInicial = document.getElementById('dataInicial')
    const idLoja = localStorage.getItem('selecaoLoja')
    const db = firebase.firestore()

    async function calcularFaturamento() {
        // só processa se ambas as datas estiverem preenchidas
        if (!dataInicial.value || !dataFinal.value) return

        // ZERA TODAS AS LETS PRA PODER INICIAR O CALCULO
        let faturamentoTotal = 0
        let custosTotais = 0
        let lucroTotal = 0

        // PUXA OS INPUTS DAS DATAS
        const inicio = parseDataInput(dataInicial.value)
        const fim = parseDataInput(dataFinal.value)
        // ajusta horário para considerar o dia inteiro
        inicio.setHours(0,0,0,0)
        fim.setHours(23,59,59,999)

        // CONVERTE PARA Timestamps DO FIRESTORE PARA FILTRAGEM DIRETA
        const timestampInicio = firebase.firestore.Timestamp.fromDate(inicio)
        const timestampFim = firebase.firestore.Timestamp.fromDate(fim)

        // ABRE O LOADING APENAS UMA VEZ
        Loading()

        try {
            // PRÉ-CARREGA TODOS OS PRODUTOS DA LOJA
            const snapshotProdutos = await db.collection('produtos')
                .where('idLoja', '==', idLoja)
                .get()
            const mapaProdutos = {}
            snapshotProdutos.forEach(doc => {
                const dados = doc.data()
                mapaProdutos[dados.nome] = dados
            })

            // FILTRA NO FIRESTORE PARA PEGAR APENAS AS VENDAS DO INTERVALO
            const snapshot = await db.collection('vendas')
                .where('idLoja', '==', idLoja)
                .where('criadoEm', '>=', timestampInicio)
                .where('criadoEm', '<=', timestampFim)
                .orderBy('criadoEm', 'asc')
                .get()

            // PROCESSA TODAS AS VENDAS EM PARALELO COM PROMISE.ALL
            const promessas = snapshot.docs.map(dados => {
                const venda = dados.data()
                console.log(venda)
                const totalVenda = Number(venda.totalVenda || 0)
                return calcularLucro(venda.produtos, venda.meiosPagamento) // apenas 2 parâmetros
                    .then(lucroVenda => ({
                        totalVenda,
                        lucroVenda: Number(lucroVenda || 0)
                    }))
            })

            const resultados = await Promise.all(promessas)

            // SOMA FATURAMENTO E LUCRO
            faturamentoTotal = resultados.reduce((acc, r) => acc + r.totalVenda, 0)
            lucroTotal = resultados.reduce((acc, r) => acc + r.lucroVenda, 0)

            // CALCULA CUSTOS TOTAIS
            custosTotais = faturamentoTotal - lucroTotal

            // ESCREVE TUDO NO SISTEMA PRA FICAR VISIVEL COM <p> mantendo títulos
            const pEntradas = document.getElementById('faturamento')
            pEntradas.textContent = 'R$ ' + faturamentoTotal.toFixed(2).replace('.',',')

            const pDespesas = document.getElementById('despesas')
            pDespesas.textContent = 'R$ ' + custosTotais.toFixed(2).replace('.',',')

            const pLucro = document.getElementById('lucro')
            const lucroPercent = faturamentoTotal > 0 ? (lucroTotal / faturamentoTotal) * 100 : 0
            pLucro.textContent = 'R$ ' + lucroTotal.toFixed(2).replace('.',',') + ' ou ' + lucroPercent.toFixed(2) + '%'

        } finally {
            // GARANTE QUE O LOADING TERMINA, MESMO SE DER ERRO
            Loading()
        }
    }

    // Atualiza sempre que mudar a data inicial ou final
    dataInicial.addEventListener('change', calcularFaturamento)
    dataFinal.addEventListener('change', calcularFaturamento)

    // Calcula inicialmente apenas se já houver valores preenchidos
    calcularFaturamento()
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

async function lucrosPorDia() {
    const idLoja = localStorage.getItem('selecaoLoja')
    const db = firebase.firestore()

    // calcula timestamp de 4 dias atrás (inclui dia atual = 5 dias no total)
    const hoje = new Date()
    hoje.setHours(0,0,0,0)  // zera hora, minuto, segundo, ms
    const quatroDiasAtras = new Date()
    quatroDiasAtras.setDate(hoje.getDate() - 4)
    quatroDiasAtras.setHours(0,0,0,0)

    const timestampLimite = firebase.firestore.Timestamp.fromDate(quatroDiasAtras)

    // pré-carrega todos os produtos da loja (mapa)
    const snapshotProdutos = await db.collection('produtos')
        .where('idLoja', '==', idLoja)
        .get()

    const mapaProdutos = {}
    snapshotProdutos.forEach(doc => {
        const dados = doc.data()
        mapaProdutos[dados.nome] = dados
    })

    // pega vendas dos últimos 5 dias
    const vendasSnapshot = await db.collection('vendas')
        .where('idLoja', '==', idLoja)
        .where('criadoEm', '>=', timestampLimite)
        .orderBy('criadoEm', 'desc')
        .get()

    // processa todas as vendas em paralelo
    const promessas = vendasSnapshot.docs.map(dados => {
        const venda = dados.data()
        return calcularLucro(venda.produtos, venda.meiosPagamento, mapaProdutos)
            .then(lucroDaVenda => ({
                lucro: lucroDaVenda,
                dataVenda: venda.data,
                idVenda: venda.idVenda
            }))
    })

    const vendasPorDia = await Promise.all(promessas)

    // agrupa lucros por data
    const lucroPorDataObj = {}
    vendasPorDia.forEach(item => {
        if (!lucroPorDataObj[item.dataVenda]) lucroPorDataObj[item.dataVenda] = 0
        lucroPorDataObj[item.dataVenda] += item.lucro
    })

    const lucroPorData = Object.keys(lucroPorDataObj).map(data => ({
        dataVenda: data,
        lucroTotal: Number(lucroPorDataObj[data].toFixed(2))
    }))

    // monta DOM usando DocumentFragment
    const fragment = document.createDocumentFragment()
    lucroPorData.forEach(dataVendas => {
        const label = document.createElement('label')

        const data = document.createElement('p')
        data.textContent = dataVendas.dataVenda
        label.appendChild(data)

        const seta = document.createElement('p')
        seta.textContent = '->'
        label.appendChild(seta)

        const reais = document.createElement('p')
        reais.textContent = 'R$' + dataVendas.lucroTotal.toFixed(2).replace('.',',')
        label.appendChild(reais)

        fragment.appendChild(label)
    })

    document.getElementById('lucroPorDia').appendChild(fragment)
}

async function vendasPorMeio() {
    const idLoja = localStorage.getItem('selecaoLoja')
    const db = firebase.firestore()

    const hoje = new Date()
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    primeiroDiaMes.setHours(0, 0, 0, 0)
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    ultimoDiaMes.setHours(23, 59, 59, 999)

    const timestampInicio = firebase.firestore.Timestamp.fromDate(primeiroDiaMes)
    const timestampFim = firebase.firestore.Timestamp.fromDate(ultimoDiaMes)

    const snapshot = await db.collection('vendas')
        .where('idLoja', '==', idLoja)
        .where('criadoEm', '>=', timestampInicio)
        .where('criadoEm', '<=', timestampFim)
        .orderBy('criadoEm', 'asc')
        .get()

    const vendasAgregadas = {}

    snapshot.forEach(doc => {
        const venda = doc.data()
        const totalVenda = Number(venda.totalVenda || 0)
        const meios = venda.meiosPagamento || []

        // Log de divergência detalhado
        const somaMeios = meios.reduce((acc, m) => acc + Number(m.valor || 0), 0)
        if (Math.abs(somaMeios - totalVenda) > 0.01) {
            const detalhesMeios = meios.map(m => `${m.tipoPagamento}: ${m.valor}`).join(' | ')
            console.warn(`Divergência na venda ${doc.id}: totalVenda=${totalVenda}, somaMeios=${somaMeios.toFixed(2)}, diferença=${(somaMeios - totalVenda).toFixed(2)} — Meios: ${detalhesMeios}`)
        }

        // Soma de todos os meios não-dinheiro desta venda
        const totalOutrosMeios = meios
            .filter(m => m.tipoPagamento !== 'DINHEIRO')
            .reduce((acc, m) => acc + Number(m.valor || 0), 0)

        // Quanto resta para o dinheiro cobrir (após os outros meios)
        const restanteParaDinheiro = Math.max(0, totalVenda - totalOutrosMeios)

        // Soma de todo dinheiro informado nesta venda
        const totalDinheiroInformado = meios
            .filter(m => m.tipoPagamento === 'DINHEIRO')
            .reduce((acc, m) => acc + Number(m.valor || 0), 0)

        // Dinheiro efetivo = apenas o que cobre o restante (sem troco)
        const dinheiroEfetivo = Math.min(totalDinheiroInformado, restanteParaDinheiro)

        // Total efetivo de outros meios = limitado ao totalVenda menos o dinheiro efetivo
        const limiteOutrosMeios = totalVenda - dinheiroEfetivo

        // Fator de escala para outros meios caso ultrapassem o limite
        const escalaOutrosMeios = totalOutrosMeios > 0
            ? Math.min(1, limiteOutrosMeios / totalOutrosMeios)
            : 1

        // Agrega cada meio de pagamento
        meios.forEach(meio => {
            const tipo = meio.tipoPagamento
            const valor = Number(meio.valor || 0)

            if (tipo === 'DINHEIRO') {
                if (totalDinheiroInformado > 0) {
                    const proporcao = valor / totalDinheiroInformado
                    vendasAgregadas['DINHEIRO'] = (vendasAgregadas['DINHEIRO'] || 0)
                        + dinheiroEfetivo * proporcao
                }
            } else {
                // Aplica escala caso a soma dos outros meios ultrapasse o limite
                vendasAgregadas[tipo] = (vendasAgregadas[tipo] || 0)
                    + valor * escalaOutrosMeios
            }
        })
    })

    // Arredonda tudo para evitar imprecisão de ponto flutuante
    Object.keys(vendasAgregadas).forEach(tipo => {
        vendasAgregadas[tipo] = Math.round(vendasAgregadas[tipo] * 100) / 100
    })

    document.getElementById('dinheiro').textContent = 'R$ ' + (vendasAgregadas['DINHEIRO'] || 0).toFixed(2).replace('.', ',')
    document.getElementById('dinheiro').style.color = 'green'

    document.getElementById('pix').textContent = 'R$ ' + (vendasAgregadas['PIX'] || 0).toFixed(2).replace('.', ',')
    document.getElementById('pix').style.color = 'blue'

    document.getElementById('debito').textContent = 'R$ ' + (vendasAgregadas['DEBITO'] || 0).toFixed(2).replace('.', ',')
    document.getElementById('debito').style.color = 'purple'

    document.getElementById('credito').textContent = 'R$ ' + (vendasAgregadas['CREDITO'] || 0).toFixed(2).replace('.', ',')
    document.getElementById('credito').style.color = 'yellow'

    document.getElementById('ifood').textContent = 'R$ ' + (vendasAgregadas['IFOOD'] || 0).toFixed(2).replace('.', ',')
    document.getElementById('ifood').style.color = 'red'

    const totalGeral = Object.values(vendasAgregadas).reduce((acc, val) => acc + val, 0)
    //console.log(`Total geral (soma de todos os meios): R$ ${totalGeral.toFixed(2).replace('.', ',')}`)
}

function Loading() {
    const loading = document.getElementById('loading')
    loading.classList.toggle('ativo')
}

vendasPorMeio()
lucrosPorDia()
faturamentoPorDia()
resumoSemanal()
saudeMensal()