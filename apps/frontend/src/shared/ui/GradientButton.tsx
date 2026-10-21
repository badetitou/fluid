import { Button, type ButtonProps } from 'antd';
import styles from './GradientButton.module.css';

/**
 * The badetitou button: a 2px brand-gradient frame around a solid face that
 * clears on hover. For a card's primary action; any antd Button prop applies.
 */
export function GradientButton({ className, ...props }: ButtonProps) {
  return <Button {...props} type="default" className={`${styles.button} ${className ?? ''}`} />;
}
