import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { Button, Popover, Tooltip, theme } from 'antd';
import {
  AppstoreOutlined,
  BankOutlined,
  BookOutlined,
  BugOutlined,
  CalendarOutlined,
  CarOutlined,
  CloudOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileOutlined,
  FlagOutlined,
  FolderOutlined,
  GiftOutlined,
  GlobalOutlined,
  HeartOutlined,
  HomeOutlined,
  IdcardOutlined,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  PictureOutlined,
  PushpinOutlined,
  RocketOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  TableOutlined,
  TagOutlined,
  TeamOutlined,
  ToolOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useConceptIcons, useConnection } from '../store';

/** Icons a concept can be given, keyed by the name stored in preferences. */
export const CONCEPT_ICONS: Record<string, ComponentType> = {
  table: TableOutlined,
  pushpin: PushpinOutlined,
  appstore: AppstoreOutlined,
  database: DatabaseOutlined,
  folder: FolderOutlined,
  file: FileOutlined,
  book: BookOutlined,
  user: UserOutlined,
  team: TeamOutlined,
  idcard: IdcardOutlined,
  home: HomeOutlined,
  bank: BankOutlined,
  shop: ShopOutlined,
  cart: ShoppingCartOutlined,
  wallet: WalletOutlined,
  card: CreditCardOutlined,
  dollar: DollarOutlined,
  gift: GiftOutlined,
  tag: TagOutlined,
  calendar: CalendarOutlined,
  mail: MailOutlined,
  message: MessageOutlined,
  phone: PhoneOutlined,
  environment: EnvironmentOutlined,
  global: GlobalOutlined,
  car: CarOutlined,
  rocket: RocketOutlined,
  cloud: CloudOutlined,
  picture: PictureOutlined,
  star: StarOutlined,
  heart: HeartOutlined,
  trophy: TrophyOutlined,
  flag: FlagOutlined,
  tool: ToolOutlined,
  bug: BugOutlined,
};

const EMPTY_ICONS: Record<string, string> = {};

/** The chosen icon key for a concept (undefined when none) and its setter, for the current source. */
export function useConceptIcon(name: string) {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const icons = useConceptIcons((s) => (graphqlUrl ? s.byUrl[graphqlUrl] : undefined)) ?? EMPTY_ICONS;
  const setIconFn = useConceptIcons((s) => s.setIcon);
  const setIcon = useCallback(
    (icon: string | null) => {
      if (graphqlUrl) setIconFn(graphqlUrl, name, icon);
    },
    [graphqlUrl, name, setIconFn],
  );
  return { icon: icons[name], setIcon };
}

/** A concept's icon: the user's choice, else table for root concepts and pushpin for pinned ones. */
export function ConceptIcon({ name, isRoot }: { name: string; isRoot: boolean }) {
  const { icon } = useConceptIcon(name);
  const Icon = (icon && CONCEPT_ICONS[icon]) || (isRoot ? TableOutlined : PushpinOutlined);
  return <Icon />;
}

/**
 * Wraps a trigger (usually a ConceptIcon) with a popover grid to pick another
 * icon. Clicks are kept from bubbling so it works inside links and cards.
 */
export function ConceptIconPicker({ name, children }: { name: string; children: ReactNode }) {
  const { token } = theme.useToken();
  const { icon, setIcon } = useConceptIcon(name);
  const [open, setOpen] = useState(false);

  const choose = (key: string | null) => {
    setIcon(key);
    setOpen(false);
  };

  const content = (
    // Popover content is portalled, but React events still bubble to the parent Link.
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ width: 232 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Object.entries(CONCEPT_ICONS).map(([key, Icon]) => (
          <Tooltip key={key} title={key} mouseEnterDelay={0.5}>
            <Button
              type={key === icon ? 'primary' : 'text'}
              size="small"
              aria-label={`Use ${key} icon`}
              icon={<Icon />}
              onClick={() => choose(key)}
            />
          </Tooltip>
        ))}
      </div>
      <Button
        type="link"
        size="small"
        disabled={!icon}
        onClick={() => choose(null)}
        style={{ padding: 0, marginTop: 8 }}
      >
        Reset to default
      </Button>
    </div>
  );

  return (
    <Popover
      title={`Icon for ${name}`}
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`Change icon of ${name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{ cursor: 'pointer', borderRadius: token.borderRadiusSM, padding: 2 }}
      >
        {children}
      </span>
    </Popover>
  );
}
