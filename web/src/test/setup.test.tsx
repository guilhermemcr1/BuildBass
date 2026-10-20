import { render, screen } from '@testing-library/react';
import { expect, test } from 'vite-plus/test';

test('ambiente de testes renderiza componentes React', () => {
    render(<p>BuildBass</p>);

    expect(screen.getByText('BuildBass')).toBeInTheDocument();
});
