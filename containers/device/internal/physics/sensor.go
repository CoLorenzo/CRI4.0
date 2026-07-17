package physics

import (
	"github.com/t3labit/cri40-scenario-tools/internal/config"
)

type Thermowell struct {
	id string

	// PROPRIETÀ
	Tau float64 `physics:"property,time_constant,seconds"` // Costante di tempo del sensore

	// INGRESSI
	RealTemperature float64 `physics:"input,real_temperature,°C"`

	// USCITE
	MeasuredTemperature DoubleBuffer `physics:"output,measured_temperature,°C"`
}

func init() {
	RegisterComponentType("thermowell", func(id string, props map[string]config.Property, capacities map[string]int) (Component, error) {
		s := &Thermowell{id: id}
		if err := AutoConfigure(s, props, capacities); err != nil {
			return nil, err
		}
		return s, nil
	})
}

func (s *Thermowell) ID() string   { return s.id }
func (s *Thermowell) Type() string { return "thermowell" }

func (s *Thermowell) Inputs() map[string]config.InternalUnit  { return BuildPortMetadata(s, "input") }
func (s *Thermowell) Outputs() map[string]config.InternalUnit { return BuildPortMetadata(s, "output") }
func (s *Thermowell) BindInput(port string) (*float64, error) { return AutoBindInput(s, port) }
func (s *Thermowell) BindOutput(port string) (*float64, error) { return AutoBindOutput(s, port) }

func (s *Thermowell) Tick(dt float64) {
	currentMeas := s.MeasuredTemperature.Current

	// Equazione differenziale discretizzata del primo ordine:
	// dT_meas/dt = (T_real - T_meas) / Tau
	deltaMeas := ((s.RealTemperature - currentMeas) / s.Tau) * dt

	s.MeasuredTemperature.Next = currentMeas + deltaMeas
}

func (s *Thermowell) Commit() {
	s.MeasuredTemperature.Commit()
}
