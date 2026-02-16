/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/order */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { NotificationContext } from '../../contexts/NotificationContext';
import { Badge, Switch } from "@nextui-org/react";
import { MoonIcon } from "./MoonIcon";
import { SunIcon } from "./SunIcon";
import {
  Navbar,
  NavbarContent,
  NavbarItem,
  Link
} from "@nextui-org/react";
import { FaCog } from "react-icons/fa";

export function AppNavbar({ darkMode, setDarkMode }) {

  const location = useLocation();
  const { pathname } = location;

  const { attackLoaded } = useContext(NotificationContext);

  return (
    <Navbar position="static" maxWidth='full'>
      <NavbarContent justify="start">
        <NavbarItem isActive={pathname === '/'}>
          <Link
            color={pathname === "/" ? "primary" : "foreground"} href="/">
            Home
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/topology'}>
          <Badge isInvisible={!attackLoaded} content="" placement='top-right' color="danger" size="sm" className='animate-pulse-fast'>
            <Link
              color={pathname === "/topology" ? "primary" : "foreground"} href="/topology">
              Topology
            </Link>
          </Badge>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/attack'}>
          <Link
            color={pathname === "/attack" ? "primary" : "foreground"} href="/attack">
            Attack
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/report'}>
          <Link
            color={pathname === "/report" ? "primary" : "foreground"} href="/report">
            Report
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/logs'}>
          <Link
            color={pathname === "/logs" ? "primary" : "foreground"} href="/logs">
            Logs
          </Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem isActive={pathname === '/settings'}>
          <Link
            color={pathname === "/settings" ? "primary" : "foreground"} href="/settings">
            <FaCog size={24} className='mt-1' />
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Switch
            defaultSelected
            isSelected={darkMode}
            size="lg"
            color="success"
            startContent={<SunIcon />}
            endContent={<MoonIcon />}
            onChange={() => { setDarkMode(!darkMode) }}
          />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  )
}
