import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestCulture } from '@/core/culture';
import { NumberCell, formatNumberCellValue } from '../NumberCellKind';

describe('NumberCellKind', () => {
  it('formats and renders number values', () => {
    const culture = createTestCulture('en-US');
    const formatted = formatNumberCellValue(12345, culture);
    render(<NumberCell value={12345} formatted={formatted} />);

    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('renders empty string for null values', () => {
    const { container } = render(<NumberCell value={null} formatted="" />);
    expect(container.querySelector('.grid-cell__value')?.textContent).toBe('');
  });

  it('applies right alignment by default', () => {
    render(<NumberCell value={9} formatted="9" />);
    expect(screen.getByText('9')).toHaveStyle({ textAlign: 'right' });
  });
});



