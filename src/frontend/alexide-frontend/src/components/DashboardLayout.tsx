import React from 'react';
import { AppShell, Burger, Flex, Avatar, Menu, Text, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Outlet } from 'react-router-dom';
import DashboardNavbar from './DashboardNavbar';
import classes from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  userRole: 'STUDENT' | 'TEACHER';
  scrollable?: boolean;
}

export default function DashboardLayout({ userRole, scrollable = false }: DashboardLayoutProps) {
  const [opened, { toggle }] = useDisclosure(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch('/api/backend/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      //console.warn('Logout endpoint failed:', err);
    } finally {
      logout();
      navigate('/auth');
    }
  };

  return (
    <AppShell
      header={{ height: 55 }}
      navbar={{
        width: 240,
        breakpoint: 'md',
        collapsed: { desktop: !opened, mobile: !opened },
      }}
      classNames={{
        root: scrollable ? classes.root : classes.rootScrollable,
        navbar: classes.navbar,
        header: classes.header,
        main: classes.main,
      }}
    >
      <AppShell.Header>
        <Flex
          className={classes.headerContent}
          h="100%"
          px="md"
          align="center"
          justify="space-between"
        >
          <Flex align="center" gap="md">
            <Burger opened={opened} onClick={toggle} size="sm" color="violet" />
            <Text size="lg" fw={700} className={classes.logo}>
              ALEXIDE
            </Text>
          </Flex>

          <Flex align="center" gap="md">
            <Menu
              width={220}
              position="bottom-end"
              offset={8}
              radius="md"
              classNames={{
                dropdown: classes.menuDropdown,
                item: classes.menuItem,
                divider: classes.menuDivider,
                label: classes.menuLabel,
              }}
            >
              <Menu.Target>
                <ActionIcon
                  className={classes.avatarButton}
                  variant="transparent"
                  data-testid="user-menu-button"
                >
                  <Avatar color="violet" radius="xl" size="md">
                    {user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>{user?.name}</Menu.Label>
                <Menu.Label style={{ marginTop: -6 }}>{user?.email}</Menu.Label>

                <Menu.Divider />

                <Menu.Item
                  className={classes.menuItemDanger}
                  leftSection={<IconLogout size={14} />}
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Flex>
        </Flex>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <DashboardNavbar userRole={userRole} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
