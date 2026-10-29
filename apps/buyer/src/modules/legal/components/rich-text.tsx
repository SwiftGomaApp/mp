import { Text } from "react-native";

type RichTextProps = {
  /** A text where words between **double stars** are shown in bold. */
  children: string;
  className: string;
};

/** A paragraph of text with optional bold words. */
export function RichText({ children, className }: RichTextProps) {
  // Splitting on the stars puts the bold words at the odd positions.
  const parts = children.split(/\*\*(.+?)\*\*/g);

  return (
    <Text className={className}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} className="font-sans-semibold">
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
