import { render, screen, fireEvent } from '@testing-library/react';
import { CommentForm } from '../CommentForm';

describe('CommentForm component', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    videoId: 'test-video',
    currentUserId: 'user-1',
    currentUserName: 'Test User',
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders comment form with textarea', () => {
    render(<CommentForm {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Add a comment...');
    expect(textarea).toBeInTheDocument();
  });

  it('submits comment with valid content', () => {
    render(<CommentForm {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Add a comment...');
    const submitButton = screen.getByText('Comment');

    fireEvent.change(textarea, { target: { value: 'Great video!' } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('Great video!', undefined);
  });

  it('shows error for empty comment', () => {
    render(<CommentForm {...defaultProps} />);
    
    const submitButton = screen.getByText('Comment');
    fireEvent.click(submitButton);

    expect(screen.getByText('Comment cannot be empty')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows character counter when near limit', () => {
    render(<CommentForm {...defaultProps} maxLength={100} />);
    
    const textarea = screen.getByPlaceholderText('Add a comment...');
    const longText = 'a'.repeat(60);
    
    fireEvent.change(textarea, { target: { value: longText } });
    
    expect(screen.getByText('40 characters remaining')).toBeInTheDocument();
  });

  it('shows cancel button when provided', () => {
    render(<CommentForm {...defaultProps} onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows timestamp checkbox when videoCurrentTime is provided', () => {
    render(<CommentForm {...defaultProps} videoCurrentTime={120} />);
    
    expect(screen.getByText(/Link to timestamp/)).toBeInTheDocument();
  });
});
