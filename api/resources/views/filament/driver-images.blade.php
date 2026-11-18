{{--
    Imagens do driver no formulário: blocos de upload compactos (sem o nome do arquivo, que é um
    UUID), a escolha da principal com miniaturas maiores e a lupa que amplia a imagem sobre a
    página. Clique fora, no X ou Esc fecha. O script usa delegação, então sobrevive aos re-renders
    do Livewire.
--}}
<style>
    .bb-driver-images .filepond--root[data-style-panel-layout='grid'] .filepond--item {
        width: 10rem;
    }

    /* O nome é um UUID: some o texto, fica o ícone de abrir a imagem em tamanho real. */
    .bb-driver-images .filepond--file-info-main {
        font-size: 0;
    }

    .bb-driver-images .filepond--open-icon {
        width: 1.25rem;
        height: 1.25rem;
    }

    .bb-cover-option {
        position: relative;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 0.375rem;
    }

    .bb-cover-option img {
        width: 6rem;
        height: 6rem;
        object-fit: contain;
        border-radius: 0.5rem;
        background: rgb(0 0 0 / 0.25);
        border: 1px solid rgb(255 255 255 / 0.1);
    }

    .bb-cover-zoom {
        position: absolute;
        top: 0.25rem;
        right: 0.25rem;
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 9999px;
        background: rgb(0 0 0 / 0.65);
        color: #fff;
    }

    .bb-cover-zoom:hover,
    .bb-cover-zoom:focus-visible {
        background: rgb(0 0 0 / 0.85);
        outline: 2px solid var(--primary-500, #f59e0b);
    }

    .bb-cover-zoom svg {
        width: 1rem;
        height: 1rem;
    }

    .bb-lightbox {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: rgb(0 0 0 / 0.85);
    }

    .bb-lightbox img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 0.5rem;
        background: #111;
    }

    .bb-lightbox button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 9999px;
        background: rgb(255 255 255 / 0.15);
        color: #fff;
        font-size: 1.5rem;
        line-height: 1;
    }
</style>
<script>
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest?.('[data-bb-zoom]')

        if (! trigger) {
            return
        }

        // A lupa fica dentro do rótulo do radio: não marca a opção ao ampliar.
        event.preventDefault()
        event.stopPropagation()

        const overlay = document.createElement('div')
        overlay.className = 'bb-lightbox'
        overlay.setAttribute('role', 'dialog')
        overlay.setAttribute('aria-modal', 'true')
        overlay.setAttribute('aria-label', trigger.getAttribute('aria-label') ?? 'Imagem')

        const image = document.createElement('img')
        image.src = trigger.dataset.bbZoom
        image.alt = ''

        const close = document.createElement('button')
        close.type = 'button'
        close.textContent = '×'
        close.setAttribute('aria-label', 'Fechar')

        const dismiss = () => {
            overlay.remove()
            document.removeEventListener('keydown', onKey)
            trigger.focus()
        }
        const onKey = (keyEvent) => keyEvent.key === 'Escape' && dismiss()

        overlay.addEventListener('click', (clickEvent) => clickEvent.target !== image && dismiss())
        document.addEventListener('keydown', onKey)
        overlay.append(image, close)
        document.body.append(overlay)
        close.focus()
    }, true)
</script>
