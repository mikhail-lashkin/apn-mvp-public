/**
 * @file: Typography.tsx
 * @description: Базовые компоненты типографики
 * @dependencies: react-native
 * @created: 2025-01-27
 */

import { Text, TextProps } from "react-native";

interface TypographyProps extends TextProps {
  variant?: "h1" | "h2" | "h3" | "body" | "caption";
  children: React.ReactNode;
}

export function Typography({ variant = "body", children, ...props }: TypographyProps) {
  const baseClasses = "text-white";
  
  const variantClasses = {
    h1: "text-3xl font-bold",
    h2: "text-2xl font-semibold",
    h3: "text-xl font-medium",
    body: "text-base",
    caption: "text-sm text-neutral-400"
  };

  return (
    <Text className={`${baseClasses} ${variantClasses[variant]}`} {...props}>
      {children}
    </Text>
  );
}
