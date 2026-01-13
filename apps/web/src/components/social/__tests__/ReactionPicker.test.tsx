import { render, screen, fireEvent } from '@testing-library/react';
import { ReactionPicker } from '../ReactionPicker';

describe('ReactionPicker component', () => {
  const mockOnSelect = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ReactionPicker isOpen={false} onSelect={mockOnSelect} onClose={mockOnClose} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders standard reactions when open', () => {
    render(
      <ReactionPicker isOpen={true} onSelect={mockOnSelect} onClose={mockOnClose} />
    );
    
    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
    expect(screen.getByText('😂')).toBeInTheDocument();
  });

  it('switches to band reactions tab', () => {
    render(
      <ReactionPicker isOpen={true} onSelect={mockOnSelect} onClose={mockOnClose} />
    );
    
    const bandTab = screen.getByText('Band');
    fireEvent.click(bandTab);
    
    expect(screen.getByText('🎺')).toBeInTheDocument();
    expect(screen.getByText('🥁')).toBeInTheDocument();
    expect(screen.getByText('🎷')).toBeInTheDocument();
  });

  it('calls onSelect when reaction is clicked', () => {
    render(
      <ReactionPicker isOpen={true} onSelect={mockOnSelect} onClose={mockOnClose} />
    );
    
    const reaction = screen.getByText('👍');
    fireEvent.click(reaction);
    
    expect(mockOnSelect).toHaveBeenCalledWith('👍');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
