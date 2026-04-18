import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FunctionMeta } from '../utils/functionMetadata';

interface FunctionSuggestionsProps {
  suggestions: FunctionMeta[];
  onSelect: (func: FunctionMeta) => void;
  visible: boolean;
}

export const FunctionSuggestions: React.FC<FunctionSuggestionsProps> = ({
  suggestions,
  onSelect,
  visible,
}) => {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} scrollEnabled={suggestions.length > 5}>
        {suggestions.map((func) => (
          <TouchableOpacity
            key={func.russianName}
            style={styles.suggestionItem}
            onPress={() => onSelect(func)}
          >
            <View style={styles.suggestionContent}>
              <Text style={styles.functionName}>{func.russianName}</Text>
              <Text style={styles.functionSyntax}>{func.syntax}</Text>
              <Text style={styles.functionDesc}>{func.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    maxHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    overflow: 'visible',
  },
  scrollView: {
    paddingVertical: 4,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 56,
    justifyContent: 'center',
  },
  suggestionContent: {
    gap: 2,
  },
  functionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#217346',
  },
  functionSyntax: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Courier New',
  },
  functionDesc: {
    fontSize: 11,
    color: '#999',
  },
});
