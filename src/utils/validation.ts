export type FieldError = string | null;

export const validate = {
  required(value: string, label = 'This field'): FieldError {
    return value.trim().length === 0 ? `${label} is required` : null;
  },

  email(value: string): FieldError {
    if (!value.trim()) return 'Email is required';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
      ? null
      : 'Enter a valid email address';
  },

  phone(value: string): FieldError {
    if (!value.trim()) return 'Phone number is required';
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15
      ? null
      : 'Enter a valid phone number';
  },

  password(value: string): FieldError {
    if (!value) return 'Password is required';
    return value.length >= 8 ? null : 'Password must be at least 8 characters';
  },

  confirmPassword(password: string, confirm: string): FieldError {
    if (!confirm) return 'Please confirm your password';
    return password === confirm ? null : 'Passwords do not match';
  },

  dateOfBirth(value: string): FieldError {
    if (!value.trim()) return 'Date of birth is required';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter date as YYYY-MM-DD';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Enter a valid date';
    if (d > new Date()) return 'Date of birth cannot be in the future';
    if (d.getFullYear() < new Date().getFullYear() - 150) return 'Enter a valid date of birth';
    return null;
  },

  // Returns null if empty (field is optional); validates format if non-empty.
  optionalDate(value: string): FieldError {
    if (!value.trim()) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter date as YYYY-MM-DD';
    const d = new Date(value);
    return isNaN(d.getTime()) ? 'Enter a valid date' : null;
  },
};
