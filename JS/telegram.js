  async function enviarTelegram(texto) {

    const lojaId = localStorage.getItem('selecaoLoja')

    const token = '8675516013:AAHXcmZrXz9m0cS40GheXYhJ_fIy_dBSDCQ'
    let chatId = ''

    if( lojaId == 'P1Ge0XdeV9akYKUH8TV1'){
        chatId = '8288551169'
    } else {
        chatId = '1611971671'
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        const resposta = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: texto
            })
        });

        const dados = await resposta.json();
        return dados;
    } catch (erro) {
        console.error("Erro ao enviar mensagem:", erro);
        throw erro;
    }
}

async function enviarTelegramImagem(base64Image, legenda = "QR Code Pix") {
    const lojaId = localStorage.getItem('selecaoLoja')

    const token = '8675516013:AAHXcmZrXz9m0cS40GheXYhJ_fIy_dBSDCQ'
    let chatId = ''

    if( lojaId == 'P1Ge0XdeV9akYKUH8TV1'){
        chatId = '8288551169'
    } else {
        chatId = '1611971671'
    }

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;

    try {
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("caption", legenda);

        const blob = await (await fetch(base64Image)).blob();
        formData.append("photo", blob, "qrcode-pix.png");

        const resposta = await fetch(url, {
            method: "POST",
            body: formData
        });

        const dados = await resposta.json();
        return dados;
    } catch (erro) {
        console.error("Erro ao enviar imagem:", erro);
        throw erro;
    }
}