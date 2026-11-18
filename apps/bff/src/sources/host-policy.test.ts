import { describe, expect, it } from 'vitest';
import { classifyAddress, createHostCheck, HostPolicyError } from './host-policy';

describe('classifyAddress', () => {
  it.each([
    ['169.254.169.254', 'linklocal'],
    ['::ffff:169.254.169.254', 'linklocal'],
    ['::ffff:a9fe:a9fe', 'linklocal'],
    ['fe80::1', 'linklocal'],
    ['febf::1', 'linklocal'],
    ['127.0.0.1', 'private'],
    ['::ffff:127.0.0.1', 'private'],
    ['::1', 'private'],
    ['10.1.2.3', 'private'],
    ['172.16.0.1', 'private'],
    ['172.32.0.1', 'public'],
    ['192.168.1.1', 'private'],
    ['100.64.0.1', 'private'],
    ['100.128.0.1', 'public'],
    ['fc00::1', 'private'],
    ['fd12::1', 'private'],
    ['8.8.8.8', 'public'],
    ['2606:4700::1111', 'public'],
  ])('%s is %s', (ip, kind) => expect(classifyAddress(ip)).toBe(kind));
});

describe('host check', () => {
  const resolve = async (h: string) => (h === 'metadata.test' ? ['169.254.169.254'] : h === 'lan.test' ? ['10.0.0.5'] : ['93.184.216.34']);

  it('always refuses link-local, even behind a name', async () => {
    const check = createHostCheck({ resolve });
    await expect(check(new URL('http://169.254.169.254/latest'))).rejects.toThrow(HostPolicyError);
    await expect(check(new URL('http://[::ffff:169.254.169.254]/'))).rejects.toThrow(HostPolicyError);
    await expect(check(new URL('http://metadata.test/'))).rejects.toThrow(HostPolicyError);
  });

  it('allows loopback and private hosts by default, refuses them in strict mode', async () => {
    const open = createHostCheck({ resolve });
    await expect(open(new URL('http://127.0.0.1:8080/'))).resolves.toBeUndefined();
    await expect(open(new URL('http://lan.test/'))).resolves.toBeUndefined();
    const strict = createHostCheck({ resolve, blockPrivate: true });
    await expect(strict(new URL('http://127.0.0.1:8080/'))).rejects.toThrow(HostPolicyError);
    await expect(strict(new URL('http://lan.test/'))).rejects.toThrow(HostPolicyError);
    await expect(strict(new URL('https://example.test/'))).resolves.toBeUndefined();
  });
});
