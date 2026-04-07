function validarCadastro() {
    const nome = document.getElementById('nome').value
    const nomeLoja = document.getElementById('loja').value
    const email = document.getElementById('email').value
    const senha = document.getElementById('senha').value
    const repetirSenha = document.getElementById('repetirSenha').value

    if (senha !== repetirSenha) {
        alert('Senhas diferentes, por favor corrija!')
        return
    }

    cadastrarNovoUsuario(nome, nomeLoja, email, senha)
}

function cadastrarNovoUsuario(nome, nomeLoja, email, senha) {
    firebase.auth().createUserWithEmailAndPassword(email, senha)
        .then(function(userCredential) {
            const user = userCredential.user
            const id = user.uid

            return enviarDadosProBD(id, nome, nomeLoja, email)
        })
        .then(() => {
            alert('Usuário cadastrado com sucesso!')
            setTimeout(() => {
                window.location.href = "/HTML/login.html";
            }, 150)
        })
        .catch(function(error) {
            console.error(error)

            if (error.code === 'auth/email-already-in-use') {
                alert('Cadastro não efetuado: este email já está em uso.')
            } else if (error.code === 'auth/weak-password') {
                alert('Cadastro não efetuado: a senha é muito fraca.')
            } else if (error.code === 'auth/invalid-email') {
                alert('Cadastro não efetuado: email inválido.')
            } else {
                alert('Erro ao cadastrar usuário.')
            }
        });
}

function enviarDadosProBD(id, nome, nomeLoja, email) {
    const lojas = []
    lojas.push({ nome: nomeLoja })

    const dadosUsuario = {
        nome: nome,
        email: email,
        id: id,
        cpf: '',
        lojas: lojas,
        status: 'Pendente aprovação'
    }

    return firebase.firestore()
        .collection('users')
        .doc(id)
        .set(dadosUsuario)
}