firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
        setTimeout(() => {
            firebase.auth().signOut()

            fetch('/login')
                .then(response => {
                    if (response.ok) {
                        window.location.href = "/login";
                    } else {
                        throw new Error('Página não encontrada');
                    }
                })
                .catch(() => {
                    alert('Você deve fazer o login primeiro!')
                    window.location.href = "/HTML/login.html";
                });
        }, 150);
        return;
    }

    try {
        const id = user.uid
        const db = firebase.firestore()
        const snapshot = await db.collection('users').doc(id).get()
        const dados = snapshot.data()

        if (dados && dados.status === 'Pendente aprovação') {
            alert('Seu cadastro ainda está pendente')
            logout()
        }
    } catch (error) {
        console.error('Erro ao buscar usuário:', error)
    }
})