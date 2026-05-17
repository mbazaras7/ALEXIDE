import React from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Stack,
  Box,
  Card,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import { IconCode, IconUsers, IconBriefcase } from '@tabler/icons-react';
import classes from './HomePage.module.css';

const FEATURES = [
  {
    icon: IconCode,
    title: 'Real-time Coding',
    description: 'Write, compile, and run code directly in your browser with instant feedback',
  },
  {
    icon: IconUsers,
    title: 'Collaborate',
    description: 'Work together with classmates and teachers in real-time',
  },
  {
    icon: IconBriefcase,
    title: 'Store Your Projects',
    description: 'Store your code files and projects in one easy place',
  },
];

function HomePage() {
  return (
    <Box className={classes.homeContainer}>
      <Container size="lg">
        <Stack gap={80} align="center">
          <Stack align="center" gap="xl" style={{ textAlign: 'center' }}>
            <Title order={1} size={100} fw={700} style={{ letterSpacing: '-2px' }}>
              ALEXIDE
            </Title>
            <Text size="xl" maw={600} c="white" opacity={0.9}>
              A collaborative web-based IDE designed to enhance programming education
            </Text>

            <Button
              component={Link}
              to="/auth"
              size="xl"
              radius="xl"
              variant="white"
              color="violet"
              className={classes.getStartedBtn}
              style={{ fontWeight: 600, fontSize: 18 }}
            >
              Get Started
            </Button>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xl" style={{ width: '100%' }}>
            {FEATURES.map((feature, index) => (
              <Card
                key={index}
                shadow="xl"
                padding="xl"
                radius="xl"
                className={classes.featureCard}
              >
                <Stack gap="lg" align="center" style={{ textAlign: 'center' }}>
                  <ThemeIcon
                    size={70}
                    radius="xl"
                    variant="light"
                    color="violet"
                    className={classes.iconWrapper}
                  >
                    <feature.icon size={36} stroke={1.5} />
                  </ThemeIcon>
                  <div>
                    <Title order={3} size="h3" mb="sm" c="white">
                      {feature.title}
                    </Title>
                    <Text size="md" c="white" opacity={0.85} style={{ lineHeight: 1.6 }}>
                      {feature.description}
                    </Text>
                  </div>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

export default HomePage;
