import { test } from '../../dist/runtime/web-test-runner.js';
import './x.js';

test('is never registered because ./x.js does not exist', () => {});