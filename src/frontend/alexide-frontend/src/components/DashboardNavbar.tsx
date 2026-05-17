import React from 'react';
import { Stack, Text, UnstyledButton, ThemeIcon, Flex } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { IconLayoutDashboard, IconBook, IconCode, type Icon } from '@tabler/icons-react';
import classes from './DashboardNavbar.module.css';

interface NavItem {
  icon: Icon;
  label: string;
  path: string;
}

const studentNavItems: NavItem[] = [
  { icon: IconLayoutDashboard, label: 'Dashboard', path: '/student/dashboard' },
  { icon: IconBook, label: 'Classes', path: '/student/classes' },
  { icon: IconCode, label: 'Code Editor', path: '/student/ide' },
];

const teacherNavItems: NavItem[] = [
  { icon: IconLayoutDashboard, label: 'Dashboard', path: '/teacher/dashboard' },
  { icon: IconBook, label: 'Classes', path: '/teacher/classes' },
  { icon: IconCode, label: 'Code Editor', path: '/teacher/ide' },
];

interface DashboardNavbarProps {
  userRole: 'STUDENT' | 'TEACHER';
}

export default function DashboardNavbar({ userRole }: DashboardNavbarProps) {
  const location = useLocation();
  const navItems = userRole === 'STUDENT' ? studentNavItems : teacherNavItems;

  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="sm">
        Navigation
      </Text>

      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          location.pathname === item.path ||
          (item.path !== '/student/dashboard' &&
            item.path !== '/teacher/dashboard' &&
            location.pathname.startsWith(item.path));

        return (
          <UnstyledButton
            component={Link}
            to={item.path}
            key={item.path}
            className={classes.navLink}
            data-active={isActive}
          >
            <Flex align="center" gap="md" w="100%">
              <ThemeIcon
                variant={isActive ? 'gradient' : 'subtle'}
                gradient={{ from: 'violet', to: 'purple', deg: 45 }}
                size="lg"
                className={classes.navIcon}
              >
                <Icon size={20} />
              </ThemeIcon>

              <Text size="sm" fw={500} style={{ flex: 1 }}>
                {item.label}
              </Text>
            </Flex>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
