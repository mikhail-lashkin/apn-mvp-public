const React = require('react');

const createComponent = (name) =>
  function MockComponent(props) {
    return React.createElement(name, props, props.children);
  };

module.exports = {
  Platform: {
    OS: 'ios',
    select: (spec) => (spec.ios !== undefined ? spec.ios : spec.default),
  },
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
    flatten: (style) => style,
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 412, height: 915, scale: 2, fontScale: 2 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  View: createComponent('View'),
  Text: createComponent('Text'),
  TextInput: createComponent('TextInput'),
  TouchableOpacity: createComponent('TouchableOpacity'),
  Pressable: createComponent('Pressable'),
  ScrollView: createComponent('ScrollView'),
  SafeAreaView: createComponent('SafeAreaView'),
  KeyboardAvoidingView: createComponent('KeyboardAvoidingView'),
  Modal: createComponent('Modal'),
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    dismiss: jest.fn(),
    removeListener: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
};
