async function login() {
    const email = document.getElementById('email');
    const senha = document.getElementById('senha');
    const db = firebase.firestore();

    try {
        const response = await firebase.auth()
            .signInWithEmailAndPassword(email.value, senha.value);

        const user = response.user;
        const id = user.uid;

        const doc = await db.collection('users').doc(id).get();

        if (!doc.exists) {
            alert("Usuário não encontrado.");
            return;
        }

        const dados = doc.data();
        const lojas = dados.lojas || {};
        let cargo = ''

        const listaLojas = [];

        Object.values(lojas).forEach(loja => {
            console.log(loja)
            console.log(loja.nome)

            listaLojas.push({
                nomeLoja: loja.nome,
                idLoja: loja.idLoja,
                cargo: loja.cargo
            });

            cargo = loja.cargo

            console.log(listaLojas)
        });

        localStorage.setItem("lojas", JSON.stringify(listaLojas));
        localStorage.setItem("userId", id);
        localStorage.setItem("selecaoLoja", '');
        localStorage.setItem("senhaUser", senha.value);

        window.location.href = "/HTML/home.html";

    } catch (error) {
        alert('Email/Senha Incorreta!');
        console.error(error);
    }
}



