import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { Sheet } from '../types';

interface SheetTabsProps {
  sheets: Sheet[];
  activeSheetId: string;
  onSwitchSheet: (id: string) => void;
  onAddSheet: (name: string) => void;
  onRenameSheet: (id: string, name: string) => void;
  onDeleteSheet: (id: string) => void;
}

export function SheetTabs({
  sheets,
  activeSheetId,
  onSwitchSheet,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
}: SheetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleLongPress = (sheet: Sheet) => {
    Alert.alert(sheet.name, '', [
      {
        text: 'Rename',
        onPress: () => { setEditingId(sheet.id); setEditName(sheet.name); },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (sheets.length > 1) onDeleteSheet(sheet.id);
          else Alert.alert('Cannot delete the last sheet');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRenameSubmit = (id: string) => {
    if (editName.trim()) onRenameSheet(id, editName.trim());
    setEditingId(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;

          if (editingId === sheet.id) {
            return (
              <View key={sheet.id} style={[styles.tab, styles.tabActive]}>
                <TextInput
                  style={styles.tabInput}
                  value={editName}
                  onChangeText={setEditName}
                  onSubmitEditing={() => handleRenameSubmit(sheet.id)}
                  onBlur={() => handleRenameSubmit(sheet.id)}
                  autoFocus
                  selectTextOnFocus
                />
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={sheet.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onSwitchSheet(sheet.id)}
              onLongPress={() => handleLongPress(sheet)}
              delayLongPress={400}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                {sheet.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            if (typeof Alert.prompt === 'function') {
              Alert.prompt('New Sheet', 'Enter name', (name: string) => {
                if (name?.trim()) onAddSheet(name.trim());
              });
            } else {
              onAddSheet(`Sheet ${sheets.length + 1}`);
            }
          }}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F1F3F4',
    borderTopWidth: 1,
    borderTopColor: '#DADCE0',
  },
  content: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 4,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#E8EAED',
    minWidth: 90,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    color: '#5F6368',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  tabInput: {
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
    minWidth: 70,
    textAlign: 'center',
    color: '#1A73E8',
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#E8EAED',
  },
  addBtnText: {
    fontSize: 20,
    color: '#5F6368',
    fontWeight: '500',
  },
});
