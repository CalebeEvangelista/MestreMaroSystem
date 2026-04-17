function openScreen(event, screenId) {

  // troca tela
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  document.getElementById(screenId).classList.add('active');

  // ativa menu
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  event.currentTarget.classList.add('active');
}

function voltarSistema() {
    window.location.href = '/HTML/home.html';
}

async function completeInfos() {
  const usersAtivos = document.getElementById('ativos')
  const usersVencendo = document.getElementById('vencendo')
  const usersInadiplentes = document.getElementById('inadiplentes')
  const faturamentoEl = document.getElementById('faturamento')

  const db = firebase.firestore()
  const snapshot = await db.collection('users').orderBy('nome').get()

  let ativos = 0
  let vencendo = 0
  let inadiplentes = 0
  let faturamentoTotal = 0

  const tabela = document.getElementById('tabelaDashboard')
  tabela.innerHTML = ''

  snapshot.forEach(usuario => {
    const user = usuario.data()

    if (user.status == 'Pendente aprovação') return

    ativos += 1

    const lojasArray = Array.isArray(user.lojas) ? user.lojas : Object.values(user.lojas)

    let lojasNomes = ''
    if (lojasArray.length > 0) {
      const primeiraLoja = lojasArray[0].data ? lojasArray[0].data().nome : lojasArray[0].nome
      const mais = lojasArray.length - 1
      lojasNomes = mais > 0 ? `${primeiraLoja} / (+${mais} Lojas)` : primeiraLoja
    } else {
      lojasNomes = 'N/A'
    }

    const tr = document.createElement('tr')
    tr.setAttribute('id', user.id)

    const nomeTd = document.createElement('td')
    nomeTd.textContent = user.nome
    tr.appendChild(nomeTd)

    const lojasTd = document.createElement('td')
    lojasTd.textContent = lojasNomes
    tr.appendChild(lojasTd)

    const usersAdc = document.createElement('td')
    usersAdc.textContent = user.adicionais || 0
    tr.appendChild(usersAdc)

    const statusTd = document.createElement('td')
    const statusReal = document.createElement('span')
    statusReal.textContent = user.status.toUpperCase() || 'S/ Status'
    statusReal.classList.add('status')

    if (user.status == 'ativo') {
      statusReal.classList.add('ativo')
    } else if (user.status == 'vencendo') {
      statusReal.classList.add('vencendo')
    } else {
      statusReal.classList.add('atraso')
    }

    statusTd.appendChild(statusReal)
    tr.appendChild(statusTd)

    const vencimentoTd = document.createElement('td');

    const data = user.dataExpiracao
      ? new Date(user.dataExpiracao.seconds * 1000)
      : null;

    vencimentoTd.textContent = data && !isNaN(data.getTime())
      ? data.toLocaleDateString('pt-BR')
      : '00/00/0000';

    tr.appendChild(vencimentoTd);

    const faturamentoTd = document.createElement('td')
    const faturamentoUser = user.faturamento || 0
    faturamentoTd.textContent = 'R$' + Number(faturamentoUser).toFixed(2).replace('.',',')
    faturamentoTotal += faturamentoUser
    tr.appendChild(faturamentoTd)

    const botoesTd = document.createElement('td')

    const btnVer = document.createElement('button')
    btnVer.textContent = 'Ver'
    btnVer.classList.add('btn')
    botoesTd.appendChild(btnVer)

    const btnEdit = document.createElement('button')
    btnEdit.textContent = 'Editar'
    btnEdit.classList.add('btn', 'edit')
    btnEdit.setAttribute('data-id', usuario.id) // <-- aqui colocamos o ID do usuário
    btnEdit.addEventListener('click', () => editarUsuario(usuario.id))
    botoesTd.appendChild(btnEdit)

    tr.appendChild(botoesTd)
    tabela.appendChild(tr)
  })

  usersAtivos.textContent = ativos
  usersVencendo.textContent = vencendo
  usersInadiplentes.textContent = inadiplentes
  faturamentoEl.textContent = 'R$ ' + Number(faturamentoTotal).toFixed(2).replace('.',',')
}

// Função que abre o Swal e busca o usuário pelo ID
async function editarUsuario(userId) {
  const db = firebase.firestore();
  const docSnap = await db.collection('users').doc(userId).get();

  if (!docSnap.exists) {
    Swal.fire('Erro', 'Usuário não encontrado', 'error');
    return;
  }

  const user = docSnap.data();

  // Normaliza lojas
  const lojasArray = Array.isArray(user.lojas) ? user.lojas : Object.values(user.lojas);

  // Usuários adicionais simulados
  const adicionaisArray = [
    { email: 'teste@teste.com', nome: 'Adicional 1' },
    { email: 'teste2@teste.com', nome: 'Adicional 2' }
  ];

  let dataExpiracao = '';

  const data = user.dataExpiracao
    ? new Date(user.dataExpiracao.seconds * 1000)
    : null;

  if (data && !isNaN(data.getTime())) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    dataExpiracao = `${ano}-${mes}-${dia}`;
  } else {
    dataExpiracao = '';
  }

   let primeiroPagamento = '';

  const data2 = user.primeiroPagamento
    ? new Date(user.primeiroPagamento.seconds * 1000)
    : null;

  if (data2 && !isNaN(data2.getTime())) {
    const ano = data2.getFullYear();
    const mes = String(data2.getMonth() + 1).padStart(2, '0');
    const dia = String(data2.getDate()).padStart(2, '0');

    primeiroPagamento = `${ano}-${mes}-${dia}`;
  } else {
    primeiroPagamento = '';
  }

  Swal.fire({
    customClass: {
      popup: 'swal-usuario-popup',
      content: 'swal-usuario-container'
    },
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    width: '65vw',        // ocupa 65% da tela
    heightAuto: false,    // respeita altura do CSS
    html: `
      <div class="swal-usuario-header">
        <h2>${user.nome}</h2>
        <p>ID: ${userId}</p>
      </div>

      <div class="swal-usuario-body">
        <!-- Esquerda: infos do usuário -->
        <div class="swal-usuario-left">
          <label>Email</label>
          <input type="email" id="swal-email" value="${user.email || ''}">
          <label>CPF</label>
          <input type="text" id="swal-cpf" value="${user.cpf || ''}">
          <label>Usuários Adicionais</label>
          <div class="swal-usuario-adicionais" id="swal-adicionais">
            ${adicionaisArray.map((ad, i) => `
              <label class="swal-usuario-adicional-label">
                <span>${ad.nome} - ${ad.email}</span>
                <button class="swal-usuario-adicional-btn swal-usuario-adicional-btn-alterar" data-index="${i}">Alterar</button>
                <button class="swal-usuario-adicional-btn swal-usuario-adicional-btn-excluir" data-index="${i}">Excluir</button>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Direita -->
        <div class="swal-usuario-right">
          <!-- Lojas -->
          <div class="swal-usuario-box">
            <h3>Lojas</h3>
            <div class="swal-usuario-lojas">
              ${lojasArray.map(lojaItem => {
                const loja = lojaItem.data ? lojaItem.data() : lojaItem;
                return `<div class="swal-usuario-loja">${loja.nome}</div>`;
              }).join('')}
            </div>
          </div>

          <!-- Status e Datas -->
          <div class="swal-usuario-box swal-usuario-box-status">
            <h3>Status e datas</h3>

            <label>Status</label>
            <select id="swal-status">
              <option value="Ativo" ${user.status === 'ativo' ? 'selected' : ''}>Ativo</option>
              <option value="Inativo" ${user.status === 'inativo' ? 'selected' : ''}>Inativo</option>
            </select>

            <label>Primeiro Pagamento</label>
            <input type="date" id="swal-primeiroPagamento" value="${primeiroPagamento || ''}" readonly>

            <label>Data de Expiração</label>
            <input type="date" id="swal-dataExpiracao" value="${dataExpiracao}" readonly>
          </div>
        </div>
      </div>
    `,
    focusConfirm: false,
    preConfirm: () => ({
      email: document.getElementById('swal-email').value,
      cpf: document.getElementById('swal-cpf').value,
      status: document.getElementById('swal-status').value,
      primeiroPagamento: document.getElementById('swal-primeiroPagamento').value,
      dataExpiracao: document.getElementById('swal-dataExpiracao').value
    })
  }).then(result => {
    if (result.isConfirmed) {
      console.log('Dados editados:', result.value);
      // Aqui você pode adicionar a lógica para Alterar/Excluir usuários adicionais
    }
  });
}

completeInfos()