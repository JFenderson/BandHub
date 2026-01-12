import { render, screen } from '@testing-library/react';
import { Pagination } from '../Pagination';
import * as navigation from 'next/navigation';

jest.mock('next/navigation');

const mockUseSearchParams = jest.spyOn(navigation, 'useSearchParams');

describe('Pagination component', () => {
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as any);
  });

  it('renders page links and navigation buttons', () => {
    render(<Pagination currentPage={2} totalPages={5} baseUrl="/videos" />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('1')).toHaveAttribute('href', '/videos?page=1');
    expect(screen.getByText('2')).toHaveClass('bg-primary-600');
  });

  it('returns null when only one page', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} baseUrl="/videos" />);
    expect(container.firstChild).toBeNull();
  });
});
