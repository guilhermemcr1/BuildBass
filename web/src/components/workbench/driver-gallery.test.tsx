import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { useCatalogGallery } from '@/stores/catalog-gallery';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriverGallery } from './driver-gallery';
import { DriverIdentity } from './driver-identity';

const IMAGES = [1, 2, 3].map((n) => ({
    url: `https://x.test/storage/driver-images/${n}.webp`,
    thumb_url: `https://x.test/storage/driver-images/${n}_thumb.webp`,
}));

describe('DriverGallery', () => {
    test('mostra uma miniatura por imagem, com texto alternativo de marca e modelo', () => {
        renderWithProviders(
            <DriverGallery name="Triton TR 620" images={IMAGES} />,
        );

        const images = screen.getAllByRole('img');
        expect(images).toHaveLength(3);
        expect(images[0]).toHaveAttribute('alt', 'Triton TR 620, foto 1 de 3');
        expect(images[2]).toHaveAttribute('alt', 'Triton TR 620, foto 3 de 3');
    });

    test('sem imagens não renderiza nada', () => {
        const { container } = renderWithProviders(
            <DriverGallery name="Triton TR 620" images={[]} />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('ampliar abre o diálogo com a imagem grande; setas navegam; Esc fecha', async () => {
        renderWithProviders(
            <DriverGallery name="Triton TR 620" images={IMAGES} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Ampliar foto 2 de 3' }),
        );

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('Foto 2 de 3');
        const big = () => dialog.querySelector(`img[src="${IMAGES[1].url}"]`);
        expect(big()).not.toBeNull();

        await userEvent.keyboard('{ArrowRight}');
        expect(dialog).toHaveTextContent('Foto 3 de 3');
        await userEvent.keyboard('{ArrowRight}');
        expect(dialog).toHaveTextContent('Foto 1 de 3');
        await userEvent.keyboard('{ArrowLeft}');
        expect(dialog).toHaveTextContent('Foto 3 de 3');

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('os botões anterior e próxima navegam', async () => {
        renderWithProviders(
            <DriverGallery name="Triton TR 620" images={IMAGES} />,
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Ampliar foto 1 de 3' }),
        );

        await userEvent.click(
            await screen.findByRole('button', { name: 'Próxima foto' }),
        );

        expect(screen.getByRole('dialog')).toHaveTextContent('Foto 2 de 3');
    });

    test('imagem ampliada que falha vira o espaço reservado', async () => {
        renderWithProviders(
            <DriverGallery name="Triton TR 620" images={IMAGES} />,
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Ampliar foto 1 de 3' }),
        );
        const dialog = await screen.findByRole('dialog');

        act(() => {
            dialog
                .querySelector(`img[src="${IMAGES[0].url}"]`)
                ?.dispatchEvent(new Event('error'));
        });

        expect(dialog.querySelector(`img[src="${IMAGES[0].url}"]`)).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Próxima foto' }),
        ).toBeInTheDocument();
    });
});

describe('DriverIdentity com a galeria do catálogo', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        useCatalogGallery.getState().clear();
    });

    test('mostra a galeria só enquanto a identificação do projeto confere', async () => {
        activeProjectStore()
            .getState()
            .setDriverIdentity({ brand: 'Triton', model: 'TR 620' });
        useCatalogGallery.getState().set('triton\u0000tr 620\u0000', IMAGES);
        renderWithProviders(<DriverIdentity />);

        expect(
            screen.getByRole('region', { name: 'Fotos do driver' }),
        ).toBeInTheDocument();

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Marca' }),
            'X',
        );

        expect(
            screen.queryByRole('region', { name: 'Fotos do driver' }),
        ).not.toBeInTheDocument();
    });

    test('sem galeria guardada, nada aparece', () => {
        renderWithProviders(<DriverIdentity />);

        expect(
            screen.queryByRole('region', { name: 'Fotos do driver' }),
        ).not.toBeInTheDocument();
    });
});
