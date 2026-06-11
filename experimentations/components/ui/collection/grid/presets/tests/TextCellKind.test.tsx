import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextCell } from '../TextCellKind';

describe('TextCellKind', () => {
  it('renders the provided value', () => {
    render(<TextCell value="Alpha" />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('applies text alignment style', () => {
    render(<TextCell value="Centered" align="center" />);
    expect(screen.getByText('Centered')).toHaveStyle({ textAlign: 'center' });
  });
});



