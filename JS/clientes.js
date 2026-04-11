async function mostrarClientes() {

    const idLoja = localStorage.getItem('selecaoLoja')

    const db = firebase.firestore()

    const clientes = await db.collection('clientes').where('idLoja', '==', idLoja).orderBy('nome').get()

    clientes.forEach(dados  => {
        const cliente = dados.data()

        const tabela = document.getElementById('tabelaListaClientes')

        const tr = document.createElement('tr')

        const nome = document.createElement('td')
        nome.textContent = cliente.nome
        tr.appendChild(nome)

        const telefone = document.createElement('td')
        const numero = cliente.telefone.replace(/\D/g, "")

        telefone.textContent = numero.length === 11
            ? numero.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4")
            : cliente.telefone
            
        tr.appendChild(telefone)

        const instagram = document.createElement('td')
        instagram.textContent = cliente.instagram
        tr.appendChild(instagram)

        const cashback = document.createElement('td')
        cashback.textContent = 'R$' + Number(cliente.cashbackTotal).toFixed(2).replace('.',',')
        tr.appendChild(cashback)

        const excluir = document.createElement('td')
        const i = document.createElement('i')
        i.classList.add('fa-solid', 'fa-xmark')
        excluir.classList.add('excluirProduct')
        excluir.setAttribute('id', produto.docId)
        excluir.setAttribute('onclick', 'excluirCliente("' + produto.docId + '")')
        excluir.appendChild(i)
        tr.appendChild(excluir)

        const editar = document.createElement('td')
        const iEditar = document.createElement('i')
        iEditar.classList.add('fa-regular', 'fa-pen-to-square')
        editar.classList.add('excluirProduct')
        editar.dataset.id = produto.docId
        editar.style.color = 'yellow'
        editar.setAttribute('onclick', 'abrirEditorCliente("' + produto.docId + '")')
        editar.appendChild(iEditar)
        tr.appendChild(editar)

        tabela.appendChild(tr)
    })
}

mostrarClientes()